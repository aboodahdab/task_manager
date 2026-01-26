const $button = document.querySelector("button");
const $email = document.querySelector("input[name='email']");
const $password = document.querySelector("input[name='password']");
const $username = document.querySelector("input[name='username']");
const $errorDiv = document.getElementById("error-box");
const $errorParagraph = document.querySelector("span");

$button.addEventListener("click", async (e) => {
  e.preventDefault();

  const email = $email.value.trim().toLowerCase();
  const password = $password.value.trim();
  const username = $username.value.trim();
  if (!somethingIsEmpty(email, password, username)) {
    return;
  }

  try {
    const response = await fetch("/create-account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, username }),
    });

    const result = await response.json();

    if (result.status === "success") {
      window.location.replace("/");
    } else {
      showError(result.message || "Failed to create account");
    }
  } catch (err) {
    console.error("❌ Error:", err);
    showError("Server error. Please try again later.");
  }
});

function showError(msg) {
  $errorParagraph.textContent = msg;
  $errorDiv.classList.remove("hidden");
  setTimeout(() => $errorDiv.classList.add("hidden"), 4500);
}

window.onload = function () {
  google.accounts.id.initialize({
    client_id: window.GOOGLE_CLIENT_ID, // Flask will inject this
    callback: handleCredentialResponse,
  });

  google.accounts.id.renderButton(document.getElementById("googleSignInDiv"), {
    theme: "outline",
    size: "large",
    width: 300,
  });
};
function somethingIsEmpty(email, password, username) {
  if (!email) {
    showError("No email");

    return false;
  }
  if ((email.match(/@/g) || []).length !== 1) {
    showError("email has more than one @ in it");
    return false;
  }
  if (email.includes(" ")) {
    showError("email includes spacing in it");
    return false;
  }

  if (!email.endsWith("@gmail.com")) {
    showError("Only Gmail addresses are allowed");
    return false;
  }
  username_email_part = email.split("@")[0];
  console.log(username_email_part, email);
  if (username_email_part.length < 6) {
    showError("Very short gmail (min 6 characters)");
    return false;
  }
  if (!password) {
    showError("No password");
    return false;
  }
  if (password.length < 8) {
    showError("Password too short (min 8 characters)");
    return false;
  }

  // Check for symbols (non-alphanumeric characters except spaces)
  const hasNumber = /\d/;
  const hasSymbol = /[^a-zA-Z0-9\s]/;
  const hasUpperCase = /[A-Z]/;

  if (
    !hasNumber.test(password) &&
    !hasSymbol.test(password) &&
    !hasUpperCase.test(password)
  ) {
    showError(
      "Password too weak (should include an integer a symbol or an uppercase letter)",
    );
    return false;
  }
  if (!username) {
    showError("No username");
    return false;
  }
  if (username.length > 25) {
    showError("too long username (max 25 characters)");
    return false;
  }

  if (username.length < 4) {
    showError("Very short username (min 4 characters)");
    return false;
  }
  return true;
}
function handleCredentialResponse(response) {
  fetch("/google-callback", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      credential: response.credential,
    }),
  }).then((res) => {
    if (res.redirected) {
      window.location.href = res.url;
    } else {
      console.log("Login failed");
    }
  });
}
