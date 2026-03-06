"""High School Management System API with basic authentication and RBAC."""

import hashlib
import json
import os
import secrets
from pathlib import Path

from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

app = FastAPI(title="Mergington High School API",
              description="API for viewing and signing up for extracurricular activities")

# Mount the static files directory
current_dir = Path(__file__).parent
app.mount("/static", StaticFiles(directory=os.path.join(Path(__file__).parent,
          "static")), name="static")


class LoginRequest(BaseModel):
    username: str
    password: str


def _hash_password(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def _load_users() -> dict[str, dict[str, str]]:
    users_path = current_dir / "users.json"
    if not users_path.exists():
        return {}

    with users_path.open("r", encoding="utf-8") as users_file:
        data = json.load(users_file)

    user_map: dict[str, dict[str, str]] = {}
    for user in data.get("users", []):
        username = user.get("username")
        password_hash = user.get("password_hash")
        role = user.get("role")

        if not username or not password_hash or not role:
            continue

        user_map[username] = {
            "password_hash": password_hash,
            "role": role,
        }
    return user_map


users = _load_users()
# In-memory session token store. This can move to a DB in future iterations.
sessions: dict[str, dict[str, str]] = {}


def _require_authenticated_user(x_session_token: str | None) -> dict[str, str]:
    if not x_session_token:
        raise HTTPException(status_code=401, detail="Authentication required")

    session = sessions.get(x_session_token)
    if not session:
        raise HTTPException(status_code=401, detail="Invalid or expired session")

    return session


def _require_admin(x_session_token: str | None) -> dict[str, str]:
    session = _require_authenticated_user(x_session_token)
    if session.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin role required")
    return session

# In-memory activity database
activities = {
    "Chess Club": {
        "description": "Learn strategies and compete in chess tournaments",
        "schedule": "Fridays, 3:30 PM - 5:00 PM",
        "max_participants": 12,
        "participants": ["michael@mergington.edu", "daniel@mergington.edu"]
    },
    "Programming Class": {
        "description": "Learn programming fundamentals and build software projects",
        "schedule": "Tuesdays and Thursdays, 3:30 PM - 4:30 PM",
        "max_participants": 20,
        "participants": ["emma@mergington.edu", "sophia@mergington.edu"]
    },
    "Gym Class": {
        "description": "Physical education and sports activities",
        "schedule": "Mondays, Wednesdays, Fridays, 2:00 PM - 3:00 PM",
        "max_participants": 30,
        "participants": ["john@mergington.edu", "olivia@mergington.edu"]
    },
    "Soccer Team": {
        "description": "Join the school soccer team and compete in matches",
        "schedule": "Tuesdays and Thursdays, 4:00 PM - 5:30 PM",
        "max_participants": 22,
        "participants": ["liam@mergington.edu", "noah@mergington.edu"]
    },
    "Basketball Team": {
        "description": "Practice and play basketball with the school team",
        "schedule": "Wednesdays and Fridays, 3:30 PM - 5:00 PM",
        "max_participants": 15,
        "participants": ["ava@mergington.edu", "mia@mergington.edu"]
    },
    "Art Club": {
        "description": "Explore your creativity through painting and drawing",
        "schedule": "Thursdays, 3:30 PM - 5:00 PM",
        "max_participants": 15,
        "participants": ["amelia@mergington.edu", "harper@mergington.edu"]
    },
    "Drama Club": {
        "description": "Act, direct, and produce plays and performances",
        "schedule": "Mondays and Wednesdays, 4:00 PM - 5:30 PM",
        "max_participants": 20,
        "participants": ["ella@mergington.edu", "scarlett@mergington.edu"]
    },
    "Math Club": {
        "description": "Solve challenging problems and participate in math competitions",
        "schedule": "Tuesdays, 3:30 PM - 4:30 PM",
        "max_participants": 10,
        "participants": ["james@mergington.edu", "benjamin@mergington.edu"]
    },
    "Debate Team": {
        "description": "Develop public speaking and argumentation skills",
        "schedule": "Fridays, 4:00 PM - 5:30 PM",
        "max_participants": 12,
        "participants": ["charlotte@mergington.edu", "henry@mergington.edu"]
    }
}


@app.get("/")
def root():
    return RedirectResponse(url="/static/index.html")


@app.get("/activities")
def get_activities():
    return activities


@app.post("/auth/login")
def login(payload: LoginRequest):
    username = payload.username.strip()
    user = users.get(username)

    if not user or user["password_hash"] != _hash_password(payload.password):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    token = secrets.token_urlsafe(32)
    sessions[token] = {
        "username": username,
        "role": user["role"],
    }

    return {
        "token": token,
        "user": {
            "username": username,
            "role": user["role"],
        }
    }


@app.post("/auth/logout")
def logout(x_session_token: str | None = Header(default=None)):
    session = _require_authenticated_user(x_session_token)
    del sessions[x_session_token]
    return {"message": f"Logged out {session['username']}"}


@app.get("/auth/me")
def auth_me(x_session_token: str | None = Header(default=None)):
    session = _require_authenticated_user(x_session_token)
    return {"user": session}


@app.post("/activities/{activity_name}/signup")
def signup_for_activity(
    activity_name: str,
    email: str,
    x_session_token: str | None = Header(default=None),
):
    """Sign up a student for an activity (admin-only)."""
    _require_admin(x_session_token)

    # Validate activity exists
    if activity_name not in activities:
        raise HTTPException(status_code=404, detail="Activity not found")

    # Get the specific activity
    activity = activities[activity_name]

    # Validate student is not already signed up
    if email in activity["participants"]:
        raise HTTPException(
            status_code=400,
            detail="Student is already signed up"
        )

    if len(activity["participants"]) >= activity["max_participants"]:
        raise HTTPException(status_code=400, detail="Activity is full")

    # Add student
    activity["participants"].append(email)
    return {"message": f"Signed up {email} for {activity_name}"}


@app.delete("/activities/{activity_name}/unregister")
def unregister_from_activity(
    activity_name: str,
    email: str,
    x_session_token: str | None = Header(default=None),
):
    """Unregister a student from an activity (admin-only)."""
    _require_admin(x_session_token)

    # Validate activity exists
    if activity_name not in activities:
        raise HTTPException(status_code=404, detail="Activity not found")

    # Get the specific activity
    activity = activities[activity_name]

    # Validate student is signed up
    if email not in activity["participants"]:
        raise HTTPException(
            status_code=400,
            detail="Student is not signed up for this activity"
        )

    # Remove student
    activity["participants"].remove(email)
    return {"message": f"Unregistered {email} from {activity_name}"}
