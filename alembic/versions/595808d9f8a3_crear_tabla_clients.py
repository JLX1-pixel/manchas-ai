"""crear tabla clients

Revision ID: 595808d9f8a3
Revises: a52a189b8e38
Create Date: 2026-07-22 01:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '595808d9f8a3'
down_revision: Union[str, Sequence[str], None] = 'a52a189b8e38'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'clients',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('business_id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(length=150), nullable=False),
        sa.Column('phone', sa.String(length=30), nullable=True),
        sa.Column('email', sa.String(length=255), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column(
            'is_frequent',
            sa.Boolean(),
            server_default='false',
            nullable=False,
        ),
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
            ['business_id'],
            ['businesses.id'],
            ondelete='CASCADE',
        ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        op.f('ix_clients_business_id'),
        'clients',
        ['business_id'],
        unique=False,
    )
    op.create_index(
        op.f('ix_clients_phone'),
        'clients',
        ['phone'],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_clients_phone'), table_name='clients')
    op.drop_index(op.f('ix_clients_business_id'), table_name='clients')
    op.drop_table('clients')
