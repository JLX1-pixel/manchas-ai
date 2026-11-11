"""Agregar versión de sesión a los usuarios.

Revision ID: b16e35f94410
Revises: f9a220c84c05
"""

import sqlalchemy as sa
from alembic import op


revision = "b16e35f94410"
down_revision = "f9a220c84c05"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("token_version", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("users", "token_version")
