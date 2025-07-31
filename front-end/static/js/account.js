const $button = document.querySelector("button");
const $email = document.querySelector("input[name='email']");
const $password = document.querySelector("input[name='password']");
const $errorDiv = document.getElementById("error-box");
const $errorParagraph = document.querySelector("span");

$button.addEventListener("click", async (e) => {
  e.preventDefault();

  const email = $email.value.trim().toLowerCase();
  const password = $password.value.trim();

  if (!email.includes("gmail")) {
    showError("Only Gmail addresses are allowed");
    return;
  }

  if (password.length < 8) {
    showError("Password too short (min 8 characters)");
    return;
  }

  try {
    const response = await fetch("/create-account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
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
