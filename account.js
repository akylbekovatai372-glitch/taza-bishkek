
const loginTab = document.querySelector("#loginTab");
const registerTab = document.querySelector("#registerTab");
const nameField = document.querySelector("#nameField");
const userName = document.querySelector("#userName");
const userEmail = document.querySelector("#userEmail");
const userPassword = document.querySelector("#userPassword");
const authSubmit = document.querySelector("#authSubmit");
const authForm = document.querySelector("#authForm");
const authMessage = document.querySelector("#authMessage");

const config = window.CONFIG;

const sb = supabase.createClient(
  config.SUPABASE_URL,
  config.SUPABASE_KEY
);

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

authForm.addEventListener("submit", async event => {
  event.preventDefault();

  const email = userEmail.value.trim();
  const password = userPassword.value;

  authSubmit.disabled = true;
  authMessage.textContent = "Пожалуйста, подождите...";

  try {
    if (authMode === "register") {
      const name = userName.value.trim();

      if (!name) {
        throw new Error("Введите ваше имя.");
      }

      
const { data, error } = await sb.auth.signUp({
  email,
  password,
  options: {
    emailRedirectTo: window.location.origin +
      "/account.html",
    data: {
      display_name: name
    }
  }
});


      if (error) throw error;

      authMessage.textContent = data.session
        ? "Регистрация успешна! Вы вошли в аккаунт."
        : "Проверьте почту. Если регистрация доступна, вам придёт письмо с подтверждением.";

    } else {
      const { error } = await sb.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      authMessage.textContent = "Вы успешно вошли в аккаунт!";
    }

  } catch (error) {
    authMessage.textContent = "Ошибка: " + error.message;
  } finally {
    authSubmit.disabled = false;
  }
});

switchAuthMode("login");

const authSection = document.querySelector("#authSection");
const myAccount = document.querySelector("#myAccount");
const accountLogout = document.querySelector("#accountLogout");
const myReports = document.querySelector("#myReports");

async function updateAccountView() {
  const { data: { user }, error } = await sb.auth.getUser();

  if (error) {
    console.error("Ошибка проверки аккаунта:", error);
    return;
  }

  const loggedIn = user && !user.is_anonymous;

  authSection.hidden = Boolean(loggedIn);
  myAccount.hidden = !loggedIn;

  if (loggedIn) {
    myReports.textContent =
      "Вы вошли в аккаунт. Скоро здесь появятся ваши заявки.";
  }
}

accountLogout.addEventListener("click", async () => {
  const { error } = await sb.auth.signOut();

  if (error) {
    alert("Не удалось выйти: " + error.message);
    return;
  }

  userPassword.value = "";
  await updateAccountView();
});

sb.auth.onAuthStateChange(() => {
  // Выполняем запросы к Supabase после завершения callback.
  setTimeout(() => {
    updateAccountView().catch(console.error);
  }, 0);
});

updateAccountView().catch(console.error);
