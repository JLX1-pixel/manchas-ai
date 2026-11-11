import unittest
from datetime import date, time, timedelta
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.database.base import Base
from app.models.appointment import Appointment, AppointmentStatus
from app.models.barber import Barber
from app.models.barber_schedule import BarberSchedule
from app.models.barber_time_off import BarberTimeOff
from app.models.business import Business
from app.models.client import Client
from app.models.service import Service
from app.models.user import User
from app.routes.appointments import _validate_slot, available_slots


class AvailabilityTests(unittest.TestCase):
    def setUp(self):
        engine = create_engine("sqlite://")
        self.addCleanup(engine.dispose)
        Base.metadata.create_all(engine)
        self.db = Session(engine)
        self.addCleanup(self.db.close)
        self.day = date(2026, 11, 12)
        self.business = Business(name="Prueba", slug="prueba", email="prueba@example.com")
        self.db.add(self.business)
        self.db.flush()
        self.user = User(business_id=self.business.id, name="Admin", email="admin@example.com", password_hash="unused")
        self.barber = Barber(business_id=self.business.id, name="Barbero")
        self.service = Service(business_id=self.business.id, name="Corte", price=Decimal("20000"), duration_minutes=45)
        self.client = Client(business_id=self.business.id, name="Clienta")
        self.db.add_all([self.user, self.barber, self.service, self.client])
        self.db.flush()
        self.schedule = BarberSchedule(barber_id=self.barber.id, weekday=self.day.weekday(), is_working=True, start_time=time(9), end_time=time(20))
        self.db.add(self.schedule)
        self.db.commit()

    def slots(self, exclude=None, **changes):
        args = dict(barber_id=self.barber.id, service_id=self.service.id,
                    appointment_date=self.day, exclude_appointment_id=exclude,
                    db=self.db, current_user=self.user)
        args.update(changes)
        return available_slots(**args)

    def book(self, start=time(9, 15), end=time(10), state=AppointmentStatus.PENDIENTE.value):
        booking = Appointment(business_id=self.business.id, barber_id=self.barber.id,
                              client_id=self.client.id, service_id=self.service.id,
                              appointment_date=self.day, start_time=start, end_time=end,
                              status=state)
        self.db.add(booking)
        self.db.commit()
        return booking

    def test_offered_hours_match_booking_validation_and_finish_by_seven(self):
        self.book()
        slots = self.slots()
        self.assertTrue(slots)
        self.assertEqual(slots[0].start_time, time(10))
        self.assertEqual(slots[-1].start_time, time(18, 15))
        self.assertEqual(slots[-1].end_time, time(19))
        for slot in slots:
            _validate_slot(self.db, self.barber.id, self.day, slot.start_time, slot.end_time)
        self.service.duration_minutes = 120
        self.db.commit()
        self.assertEqual(self.slots()[-1].start_time, time(17))

    def test_cancelled_completed_and_no_show_hours_are_available(self):
        booking = self.book(start=time(9), end=time(9, 45))
        self.assertNotIn(time(9), [slot.start_time for slot in self.slots()])
        for state in (AppointmentStatus.CANCELADA, AppointmentStatus.COMPLETADA, AppointmentStatus.NO_ASISTIO):
            booking.status = state.value
            self.db.commit()
            self.assertIn(time(9), [slot.start_time for slot in self.slots()])

    def test_rescheduling_excludes_only_the_selected_appointment(self):
        booking = self.book(start=time(9), end=time(9, 45))
        self.book(start=time(10), end=time(10, 45), state=AppointmentStatus.CONFIRMADA.value)
        slots = self.slots(exclude=booking.id)
        self.assertIn(time(9), [slot.start_time for slot in slots])
        self.assertNotIn(time(10), [slot.start_time for slot in slots])

    def test_time_off_nonworking_day_and_missing_schedule_return_no_hours(self):
        period = BarberTimeOff(barber_id=self.barber.id, start_date=self.day - timedelta(days=1), end_date=self.day + timedelta(days=1))
        self.db.add(period)
        self.db.commit()
        self.assertEqual(self.slots(), [])
        self.db.delete(period)
        self.schedule.is_working = False
        self.db.commit()
        self.assertEqual(self.slots(), [])
        self.db.delete(self.schedule)
        self.db.commit()
        self.assertEqual(self.slots(), [])

    def test_foreign_business_records_and_exclusions_are_rejected(self):
        other = Business(name="Otro", slug="otro", email="otro@example.com")
        self.db.add(other)
        self.db.flush()
        barber = Barber(business_id=other.id, name="Otro barbero")
        service = Service(business_id=other.id, name="Otro servicio", price=Decimal("10000"), duration_minutes=30)
        self.db.add_all([barber, service])
        self.db.flush()
        booking = self.book()
        booking.business_id = other.id
        self.db.commit()
        for args in (dict(barber_id=barber.id), dict(service_id=service.id), dict(exclude=booking.id)):
            with self.assertRaises(HTTPException) as failure:
                self.slots(**args)
            self.assertEqual(failure.exception.status_code, 404)

    def test_inactive_records_are_rejected_and_long_service_has_no_hours(self):
        self.service.duration_minutes = 1440
        self.db.commit()
        self.assertEqual(self.slots(), [])
        self.barber.is_active = False
        self.db.commit()
        with self.assertRaises(HTTPException) as failure:
            self.slots()
        self.assertEqual(failure.exception.status_code, 400)

    def test_calendar_limit_and_existing_seconds_are_supported(self):
        self.day = date.max
        self.schedule.weekday = self.day.weekday()
        self.schedule.start_time = time(9, 7, 30)
        self.db.commit()
        slots = self.slots()
        self.assertEqual(slots[0].start_time, time(9, 7, 30))
        self.assertEqual(slots[0].end_time, time(9, 52, 30))
        self.assertLessEqual(slots[-1].end_time, time(19))
