# Mergington High School Activities API

A simple FastAPI application for managing extracurricular activities with
basic authentication and role-based access control.

## Features

- View all available extracurricular activities
- Admin login/logout
- Admin-only registration and unregistration

## Getting Started

1. Install the dependencies:

   ```
   pip install fastapi uvicorn
   ```

2. Run the application:

   ```
   uvicorn app:app --reload
   ```

3. Open your browser and go to:
   - API documentation: http://localhost:8000/docs
   - Alternative documentation: http://localhost:8000/redoc

## API Endpoints

| Method | Endpoint                                                          | Description                                                         |
| ------ | ----------------------------------------------------------------- | ------------------------------------------------------------------- |
| GET    | `/activities`                                                     | Get all activities with their details and current participant count |
| POST   | `/auth/login`                                                     | Login and get a session token                                       |
| POST   | `/auth/logout`                                                    | Logout using `X-Session-Token` header                              |
| GET    | `/auth/me`                                                        | Get current session user from `X-Session-Token` header             |
| POST   | `/activities/{activity_name}/signup?email=student@mergington.edu` | Admin-only sign up for an activity                                  |
| DELETE | `/activities/{activity_name}/unregister?email=student@mergington.edu` | Admin-only remove a student from an activity                    |

## Default Admin Credentials

For local development, credentials are loaded from `users.json`:

- Username: `teacher1`
- Password: `admin123`

Passwords are compared using SHA-256 hashes stored in `users.json`.

## Data Model

The application uses a simple data model with meaningful identifiers:

1. **Activities** - Uses activity name as identifier:

   - Description
   - Schedule
   - Maximum number of participants allowed
   - List of student emails who are signed up

2. **Students** - Uses email as identifier:
   - Name
   - Grade level

All data is stored in memory, which means data will be reset when the server restarts.
