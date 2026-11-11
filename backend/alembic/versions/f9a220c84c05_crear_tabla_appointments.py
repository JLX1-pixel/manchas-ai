"""crear tabla appointments

Revision ID: f9a220c84c05
Revises: 596a36818c33
Create Date: 2026-07-22 02:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f9a220c84c05'
down_revision: Union[str, Sequence[str], None] = '596a36818c33'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'appointments',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('business_id', sa.UUID(), nullable=False),
        sa.Column('client_id', sa.UUID(), nullable=False),
        sa.Column('barber_id', sa.UUID(), nullable=False),
        sa.Column('service_id', sa.UUID(), nullable=False),
        sa.Column('appointment_date', sa.Date(), nullable=False),
        sa.Column('start_time', sa.Time(), nullable=False),
        sa.Column('end_time', sa.Time(), nullable=False),
        sa.Column(
            'status',
            sa.String(length=20),
            server_default='PENDIENTE',
            nullable=False,
        ),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False,
        ),
        sa.Column(
            'updated_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ['business_id'], ['businesses.id'], ondelete='CASCADE'
        ),
        sa.ForeignKeyConstraint(
            ['client_id'], ['clients.id'], ondelete='CASCADE'
        ),
        sa.ForeignKeyConstraint(
            ['barber_id'], ['barbers.id'], ondelete='CASCADE'
        ),
        sa.ForeignKeyConstraint(
            ['service_id'], ['services.id'], ondelete='RESTRICT'
        ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        op.f('ix_appointments_business_id'),
        'appointments',
        ['business_id'],
        unique=False,
    )
    op.create_index(
        op.f('ix_appointments_client_id'),
        'appointments',
        ['client_id'],
        unique=False,
    )
    op.create_index(
        op.f('ix_appointments_barber_id'),
        'appointments',
        ['barber_id'],
        unique=False,
    )
    op.create_index(
        op.f('ix_appointments_service_id'),
        'appointments',
        ['service_id'],
        unique=False,
    )
    op.create_index(
        op.f('ix_appointments_appointment_date'),
        'appointments',
        ['appointment_date'],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(
        op.f('ix_appointments_appointment_date'),
        table_name='appointments',
    )
    op.drop_index(
        op.f('ix_appointments_service_id'), table_name='appointments'
    )
    op.drop_index(
        op.f('ix_appointments_barber_id'), table_name='appointments'
    )
    op.drop_index(
        op.f('ix_appointments_client_id'), table_name='appointments'
    )
    op.drop_index(
        op.f('ix_appointments_business_id'), table_name='appointments'
    )
    op.drop_table('appointments')
