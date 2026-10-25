
const loginTab = document.querySelector("#loginTab");
const registerTab = document.querySelector("#registerTab");
const nameField = document.querySelector("#nameField");
const userName = document.querySelector("#userName");
const userPassword = document.querySelector("#userPassword");
const authSubmit = document.querySelector("#authSubmit");
const authForm = document.querySelector("#authForm");
const authMessage = document.querySelector("#authMessage");

let authMode = "login";

function switchAuthMode(mode) {
  authMode = mode;

  const registering = mode === "register";

  loginTab.classList.toggle("active", !registering);
  registerTab.classList.toggle("active", registering);

  nameField.hidden = !registering;
  userName.required = registering;

  userPassword.autocomplete = registering
    ? "new-password"
    : "current-password";

  authSubmit.textContent = registering
    ? "Зарегистрироваться"
    : "Войти";

  authMessage.textContent = "";
}

loginTab.addEventListener("click", () => {
  switchAuthMode("login");
});

registerTab.addEventListener("click", () => {
  switchAuthMode("register");
});

authForm.addEventListener("submit", event => {
  event.preventDefault();

  authMessage.textContent =
    "Форма готова. Подключение аккаунтов появится следующим шагом.";
});

switchAuthMode("login");
