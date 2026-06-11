"""drop access insights setting

Revision ID: 23_drop_access_insights
Revises: 22_drop_user_templates
Create Date: 2026-06-10 01:23:00.000000

"""

from alembic import op
import sqlalchemy as sa


revision = "23_drop_access_insights"
down_revision = "22_drop_user_templates"
branch_labels = None
depends_on = None


def _has_column(table_name: str, column_name: str) -> bool:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if table_name not in inspector.get_table_names():
        return False
    return column_name in {column["name"] for column in inspector.get_columns(table_name)}


def upgrade() -> None:
    if _has_column("panel_settings", "access_insights_enabled"):
        with op.batch_alter_table("panel_settings") as batch_op:
            batch_op.drop_column("access_insights_enabled")


def downgrade() -> None:
    if not _has_column("panel_settings", "access_insights_enabled"):
        with op.batch_alter_table("panel_settings") as batch_op:
            batch_op.add_column(
                sa.Column(
                    "access_insights_enabled",
                    sa.Boolean(),
                    nullable=False,
                    server_default=sa.text("0"),
                )
            )
