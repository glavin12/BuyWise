"""make conversations user_id nullable

Revision ID: 202608020001
Revises: 202607310001
Create Date: 2026-08-02
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "202608020001"
down_revision: Union[str, None] = "202607310001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "conversations",
        "user_id",
        existing_type=postgresql.UUID(as_uuid=True),
        existing_nullable=False,
        nullable=True,
        schema="public",
    )


def downgrade() -> None:
    op.execute("delete from public.conversations where user_id is null")
    op.alter_column(
        "conversations",
        "user_id",
        existing_type=postgresql.UUID(as_uuid=True),
        existing_nullable=True,
        nullable=False,
        schema="public",
    )
