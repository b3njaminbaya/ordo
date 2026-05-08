### Taskly Backend
 **Overview**
Taskly is a task management system designed to help users efficiently organize and track their tasks. This backend, built with Flask, handles user management, task assignments, comments, notifications, and real-time updates

**By Benjamin Baya, Rome Ojuro , Larry Mecha and Nadifo Ismail**

## Resources
- Deployed Backend: [https://taskly-app-9u0e.onrender.com]
- Deployed Frontend: [https://taskly-app-iota.vercel.app]
- Slides link: [https://docs.google.com/presentation/d/1xOcORaEO7jcECurvcL3LSUZDYCb-8kgVMYuOM4AK4WY/edit?usp=sharing]
- Frontend link:[https://github.com/benjaminmweribaya/taskly-app-front-end/tree/main]

## Technologies Used
- **Backend:** Flask, Flask-JWT-Extended, Flask-SQLAlchemy  
- **Database:** PostgreSQL  
- **Real-Time Communication:** WebSocket (Flask-SocketIO)  
- **Authentication:** JWT (JSON Web Token)  
- **Deployment:** Render  
- **Others:** SQLAlchemy Serializer, Gunicorn  

## Project Structure
        ├── app.py
        ├── instance
        │   └── taskly.db
        ├── LICENSE.md
        ├── migrations
        │   ├── alembic.ini
        │   ├── env.py
        │   ├── README
        │   └── script.py.mako
        ├── models.py
        ├── Pipfile
        ├── Pipfile.lock
        ├── __pycache__
        │   ├── app.cpython-312.pyc
        │   └── models.cpython-312.pyc
        ├── README.md
        ├── requirements.txt
        ├── seed.py
        ├── task
        │   ├── bin
        │   ├── include
        │   ├── lib
        │   ├── lib64 -> lib
        │   ├── pipenv-proper-names.txt
        │   ├── pyvenv.cfg
        │   └── src
        └── views
            ├── auth.py
            ├── comments.py
            ├── __init__.py
            ├── notifications.py
            ├── taskassignment.py
            ├── tasklist.py
            ├── task.py
            └── user.py
## Prerequisites
Before running this project, ensure you have:  
- Python 3.8 + installed  
- PostgreSQL database set up  
- Virtual environment (`venv`) installed  

## Installation
 **1. Clone the repository**
- git clone <repository-url>
- cd taskly-backend

**2. Create and activate a vitual environment**
- python -m venv venv
- source venv/bin/activate  # On Windows use: venv\Scripts\activate


**3. Install the dependencies**
- pip install -r requirements.txt

**4. Set up environment variables**
- Create a .env file and configure database settings:
    DATABASE_URL=postgresql://username:password@localhost:5432/taskly_db
    SECRET_KEY=your_secret_key

**5.Run the migrations**
- flask db upgrade

**6. Start the server**
**In Development :**
- flask run --debug

**In Production :**
- gunicorn -k gevent -w 1 app:app

## Features
- **User Authentication:** Register, login, JWT authentication  
- **Role-Based Access Control (RBAC):** Admin and user roles  
- **Task Management:** Create, update, assign, and delete tasks  
- **Comments:** Add and manage comments on tasks  
- **Notifications:** Receive real-time task updates via WebSocket  
- **Task Prioritization:** Set priorities like low, medium, high, and urgent  
- **Task Status Updates:** Track progress with statuses like pending, in-progress, completed, and todo  
- **Real-Time Updates:** WebSocket (Flask-SocketIO) for instant task changes and notifications  

## Usage Guide
- Admins can manage users, assign tasks, and oversee task progress.
- Users can create and manage their own tasks, comment on tasks, and receive notifications.

## Known Issues
None reported. Feel free to open an issue if you encounter any problems.

## License
LIcenced under the [https://github.com/benjaminmweribaya/taskly-app-back-end/blob/main/LICENSE.md]

Copyright (c) 2025 Benjamin Baya, Rome Ojuro , Larry Mecha and Nadifo Ismail