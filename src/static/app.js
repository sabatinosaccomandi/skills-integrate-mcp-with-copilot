document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");
  const authForm = document.getElementById("auth-form");
  const logoutBtn = document.getElementById("logout-btn");
  const authStatus = document.getElementById("auth-status");
  const authHint = document.getElementById("auth-hint");

  let sessionToken = localStorage.getItem("sessionToken") || "";
  let currentUser = null;

  function authHeaders() {
    if (!sessionToken) {
      return {};
    }

    return {
      "X-Session-Token": sessionToken,
    };
  }

  function isAdmin() {
    return currentUser && currentUser.role === "admin";
  }

  function showMessage(message, kind) {
    messageDiv.textContent = message;
    messageDiv.className = kind;
    messageDiv.classList.remove("hidden");

    setTimeout(() => {
      messageDiv.classList.add("hidden");
    }, 5000);
  }

  function updateAuthUI() {
    const admin = isAdmin();
    authStatus.textContent = admin
      ? `Logged in as ${currentUser.username} (admin)`
      : "Browsing as student";

    authHint.textContent = admin
      ? "Admin mode enabled. You can register and unregister students."
      : "Only admins can register or remove students from activities.";

    authForm.classList.toggle("hidden", admin);
    logoutBtn.classList.toggle("hidden", !admin);

    const submitButton = signupForm.querySelector("button[type='submit']");
    submitButton.disabled = !admin;
    submitButton.title = admin ? "" : "Admin login required";
  }

  async function syncSessionFromServer() {
    if (!sessionToken) {
      currentUser = null;
      updateAuthUI();
      return;
    }

    try {
      const response = await fetch("/auth/me", {
        headers: authHeaders(),
      });

      if (!response.ok) {
        sessionToken = "";
        localStorage.removeItem("sessionToken");
        currentUser = null;
        updateAuthUI();
        return;
      }

      const result = await response.json();
      currentUser = result.user;
    } catch (error) {
      console.error("Error validating session:", error);
      currentUser = null;
    }

    updateAuthUI();
  }

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      // Clear loading message
      activitiesList.innerHTML = "";
      activitySelect.innerHTML =
        '<option value="">-- Select an activity --</option>';

      const admin = isAdmin();

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft =
          details.max_participants - details.participants.length;

        // Create participants HTML with delete icons instead of bullet points
        const participantsHTML =
          details.participants.length > 0
            ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map(
                    (email) =>
                      `<li><span class="participant-email">${email}</span>${
                        admin
                          ? `<button class="delete-btn" data-activity="${name}" data-email="${email}">Unregister</button>`
                          : ""
                      }</li>`
                  )
                  .join("")}
              </ul>
            </div>`
            : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      // Add event listeners to delete buttons
      document.querySelectorAll(".delete-btn").forEach((button) => {
        button.addEventListener("click", handleUnregister);
      });
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle unregister functionality
  async function handleUnregister(event) {
    if (!isAdmin()) {
      showMessage("Admin login required", "error");
      return;
    }

    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
          headers: authHeaders(),
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to unregister. Please try again.", "error");
      console.error("Error unregistering:", error);
    }
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!isAdmin()) {
      showMessage("Admin login required", "error");
      return;
    }

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
          headers: authHeaders(),
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");
        signupForm.reset();

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to sign up. Please try again.", "error");
      console.error("Error signing up:", error);
    }
  });

  authForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    try {
      const response = await fetch("/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const result = await response.json();
      if (!response.ok) {
        showMessage(result.detail || "Login failed", "error");
        return;
      }

      sessionToken = result.token;
      localStorage.setItem("sessionToken", sessionToken);
      currentUser = result.user;

      authForm.reset();
      updateAuthUI();
      fetchActivities();
      showMessage("Admin login successful", "success");
    } catch (error) {
      console.error("Error logging in:", error);
      showMessage("Login failed. Please try again.", "error");
    }
  });

  logoutBtn.addEventListener("click", async () => {
    try {
      if (sessionToken) {
        await fetch("/auth/logout", {
          method: "POST",
          headers: authHeaders(),
        });
      }
    } catch (error) {
      console.error("Error logging out:", error);
    } finally {
      sessionToken = "";
      currentUser = null;
      localStorage.removeItem("sessionToken");
      updateAuthUI();
      fetchActivities();
      showMessage("Logged out", "info");
    }
  });

  // Initialize app
  syncSessionFromServer().then(fetchActivities);
});
