"""backfill conversation titles from first user message

Revision ID: 202608070001
Revises: 202608050002
Create Date: 2026-08-07
"""

from typing import Sequence, Union

from alembic import op

revision: str = "202608070001"
down_revision: Union[str, None] = "202608050002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Mirrors `_derive_title` in ai_service/services/conversation_service.py:
# collapse whitespace, trim, truncate at 60 chars (ellipsis on cut).
_DERIVED = """
case
    when length(btrim(regexp_replace(content, '\\s+', ' ', 'g'))) > 60
        then left(btrim(regexp_replace(content, '\\s+', ' ', 'g')), 59) || '…'
    else btrim(regexp_replace(content, '\\s+', ' ', 'g'))
end
"""

_FIRST_MESSAGE_CTE = f"""
with first_messages as (
    select distinct on (conversation_id)
        conversation_id,
        {_DERIVED} as derived_title
    from public.messages
    where role = 'user'
    order by conversation_id, created_at asc, id asc
)
"""


def upgrade() -> None:
    # Fill titles from each conversation's first user message. Existing
    # user-set titles and soft-deleted conversations are left untouched.
    op.execute(
        _FIRST_MESSAGE_CTE
        + """
        update public.conversations c
        set title = fm.derived_title
        from first_messages fm
        where c.id = fm.conversation_id
          and c.title is null
          and c.deleted_at is null
        """
    )


def downgrade() -> None:
    # Reverse only backfilled titles: reset to NULL those that still match
    # the derived value. Manually-set titles survive.
    op.execute(
        _FIRST_MESSAGE_CTE
        + """
        update public.conversations c
        set title = null
        from first_messages fm
        where c.id = fm.conversation_id
          and c.title = fm.derived_title
        """
    )
