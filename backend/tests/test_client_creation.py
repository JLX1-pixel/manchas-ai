import unittest

from pydantic import ValidationError

from app.schemas.client import ClientCreate


class ClientCreationTests(unittest.TestCase):
    def test_short_names_are_rejected_after_trimming(self):
        for name in ("  ", "\t\n", " A "):
            with self.subTest(name=name), self.assertRaises(ValidationError):
                ClientCreate(name=name)

    def test_valid_name_is_trimmed_without_changing_internal_spaces(self):
        client = ClientCreate(name="  María del Carmen  ", phone="3000000000")
        self.assertEqual(client.name, "María del Carmen")
        self.assertEqual(client.phone, "3000000000")

    def test_name_type_and_length_are_still_validated(self):
        for name in (None, 123, "x" * 151):
            with self.subTest(name=name), self.assertRaises(ValidationError):
                ClientCreate(name=name)
