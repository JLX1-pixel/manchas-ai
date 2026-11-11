"""crear tablas barbers, barber_schedules y barber_time_off

Revision ID: 596a36818c33
Revises: 1e33944f1e3f
Create Date: 2026-07-22 02:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '596a36818c33'
down_revision: Union[str, Sequence[str], None] = '1e33944f1e3f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'barbers',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('business_id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=True),
        sa.Column('name', sa.String(length=150), nullable=False),
        sa.Column('phone', sa.String(length=30), nullable=True),
        sa.Column('specialty', sa.String(length=150), nullable=True),
        sa.Column(
            'is_active',
            sa.Boolean(),
            server_default='true',
            nullable=False,
        ),
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
            ['user_id'], ['users.id'], ondelete='SET NULL'
        ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id'),
    )
    op.create_index(
        op.f('ix_barbers_business_id'),
        'barbers',
        ['business_id'],
        unique=False,
    )

    op.create_table(
        'barber_schedules',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('barber_id', sa.UUID(), nullable=False),
        sa.Column('weekday', sa.Integer(), nullable=False),
        sa.Column(
            'is_working',
            sa.Boolean(),
            server_default='true',
            nullable=False,
        ),
        sa.Column('start_time', sa.Time(), nullable=True),
        sa.Column('end_time', sa.Time(), nullable=True),
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
            ['barber_id'], ['barbers.id'], ondelete='CASCADE'
        ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint(
            'barber_id', 'weekday', name='uq_barber_schedule_weekday'
        ),
    )
    op.create_index(
        op.f('ix_barber_schedules_barber_id'),
        'barber_schedules',
        ['barber_id'],
        unique=False,
    )

    op.create_table(
        'barber_time_off',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('barber_id', sa.UUID(), nullable=False),
        sa.Column('start_date', sa.Date(), nullable=False),
        sa.Column('end_date', sa.Date(), nullable=False),
        sa.Column('reason', sa.String(length=255), nullable=True),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ['barber_id'], ['barbers.id'], ondelete='CASCADE'
        ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        op.f('ix_barber_time_off_barber_id'),
        'barber_time_off',
        ['barber_id'],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(
        op.f('ix_barber_time_off_barber_id'), table_name='barber_time_off'
    )
    op.drop_table('barber_time_off')

    op.drop_index(
        op.f('ix_barber_schedules_barber_id'),
        table_name='barber_schedules',
    )
    op.drop_table('barber_schedules')

    op.drop_index(op.f('ix_barbers_business_id'), table_name='barbers')
    op.drop_table('barbers')
