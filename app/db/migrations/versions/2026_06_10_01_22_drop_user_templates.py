"""drop user templates

Revision ID: 22_drop_user_templates
Revises: 21_pending_node_certificates
Create Date: 2026-06-10 01:22:00.000000

"""

from alembic import op
import sqlalchemy as sa


revision = "22_drop_user_templates"
down_revision = "21_pending_node_certificates"
branch_labels = None
depends_on = None


def _has_table(table_name: str) -> bool:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return table_name in inspector.get_table_names()


def upgrade() -> None:
    if _has_table("template_inbounds_association"):
        op.drop_table("template_inbounds_association")
    if _has_table("user_templates"):
        op.drop_table("user_templates")


def downgrade() -> None:
    if not _has_table("user_templates"):
        op.create_table(
            "user_templates",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("name", sa.String(length=64), nullable=False, unique=True),
            sa.Column("data_limit", sa.BigInteger(), nullable=True, default=0),
            sa.Column("expire_duration", sa.BigInteger(), nullable=True, default=0),
            sa.Column("username_prefix", sa.String(length=20), nullable=True),
            sa.Column("username_suffix", sa.String(length=20), nullable=True),
        )
        op.create_index(op.f("ix_user_templates_id"), "user_templates", ["id"], unique=False)

    if not _has_table("template_inbounds_association"):
        op.create_table(
            "template_inbounds_association",
            sa.Column("user_template_id", sa.Integer(), nullable=True),
            sa.Column("inbound_tag", sa.String(length=256), nullable=True),
            sa.ForeignKeyConstraint(["user_template_id"], ["user_templates.id"]),
            sa.ForeignKeyConstraint(["inbound_tag"], ["inbounds.tag"]),
        )
