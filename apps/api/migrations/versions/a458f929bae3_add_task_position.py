"""add_task_position

Revision ID: a458f929bae3
Revises: 1db03fd43e73
Create Date: 2026-06-08 02:12:38.309183

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a458f929bae3'
down_revision = '1db03fd43e73'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('tasks', schema=None) as batch_op:
        batch_op.add_column(sa.Column('position', sa.Integer(), nullable=False, server_default='0'))

    # Backfill: assign sequential positions per status group, ordered by created_at then id
    connection = op.get_bind()
    rows = connection.execute(
        sa.text("SELECT id, status FROM tasks ORDER BY status, created_at, id")
    ).fetchall()
    pos_counter = {}
    for row in rows:
        task_id, status = row[0], row[1]
        pos_counter[status] = pos_counter.get(status, -1) + 1
        connection.execute(
            sa.text("UPDATE tasks SET position = :pos WHERE id = :id"),
            {"pos": pos_counter[status], "id": task_id},
        )


def downgrade():
    with op.batch_alter_table('tasks', schema=None) as batch_op:
        batch_op.drop_column('position')
