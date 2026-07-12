"""add time_entries table

Revision ID: b2c4d8e1f3a5
Revises: 4e8da831e769
Create Date: 2026-07-12 21:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'b2c4d8e1f3a5'
down_revision = '4e8da831e769'
branch_labels = None
depends_on = None

time_category = postgresql.ENUM(
    'focus', 'meeting', 'review', 'other',
    name='time_category',
    create_type=True,
)


def upgrade():
    time_category.create(op.get_bind(), checkfirst=True)
    op.create_table(
        'time_entries',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('task_id', sa.Integer(), nullable=True),
        sa.Column('tasklist_id', sa.Integer(), nullable=True),
        sa.Column('started_at', sa.DateTime(), nullable=False),
        sa.Column('ended_at', sa.DateTime(), nullable=True),
        sa.Column('duration_seconds', sa.Integer(), nullable=True),
        sa.Column('note', sa.String(length=300), nullable=True),
        sa.Column('category', time_category, nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['task_id'], ['tasks.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['tasklist_id'], ['tasklists.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_time_entries_user_ended_at', 'time_entries', ['user_id', 'ended_at'])


def downgrade():
    op.drop_index('ix_time_entries_user_ended_at', table_name='time_entries')
    op.drop_table('time_entries')
    time_category.drop(op.get_bind(), checkfirst=True)
