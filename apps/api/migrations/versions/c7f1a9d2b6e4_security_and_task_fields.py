"""token revocation, workspace owner, task completion/list order, one active timer

Revision ID: c7f1a9d2b6e4
Revises: b2c4d8e1f3a5
Create Date: 2026-09-20 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'c7f1a9d2b6e4'
down_revision = 'b2c4d8e1f3a5'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('users', sa.Column('password_changed_at', sa.DateTime(), nullable=True))
    op.add_column('workspaces', sa.Column('owner_id', sa.Integer(), nullable=True))
    op.add_column('tasks', sa.Column('completed_at', sa.DateTime(), nullable=True))
    op.add_column('tasks', sa.Column('list_position', sa.Integer(), nullable=False, server_default='0'))

    # Backfill
    op.execute("UPDATE tasks SET completed_at = updated_at WHERE status = 'completed'")
    op.execute("UPDATE tasks SET list_position = position")
    op.execute(
        "UPDATE workspaces SET owner_id = "
        "(SELECT MIN(u.id) FROM users u WHERE u.workspace_id = workspaces.id)"
    )
    # A unique index below needs at most one open timer per user: close older duplicates.
    op.execute(
        "UPDATE time_entries SET ended_at = started_at, duration_seconds = 0 "
        "WHERE ended_at IS NULL AND id NOT IN "
        "(SELECT MAX(id) FROM time_entries WHERE ended_at IS NULL GROUP BY user_id)"
    )

    op.create_index(
        'uq_time_entries_one_active', 'time_entries', ['user_id'], unique=True,
        postgresql_where=sa.text('ended_at IS NULL'),
        sqlite_where=sa.text('ended_at IS NULL'),
    )


def downgrade():
    op.drop_index('uq_time_entries_one_active', table_name='time_entries')
    op.drop_column('tasks', 'list_position')
    op.drop_column('tasks', 'completed_at')
    op.drop_column('workspaces', 'owner_id')
    op.drop_column('users', 'password_changed_at')
