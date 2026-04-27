const form = document.getElementById("checkin-form");
const statusEl = document.getElementById("status");
const submitBtn = document.getElementById("submit-btn");
const saveBtn = document.getElementById("save-btn");
const dateInput = document.getElementById("date");
const profileInput = document.getElementById("profile");
const photoInput = document.getElementById("photo");

const today = new Date();
const isoToday = new Date(today.getTime() - today.getTimezoneOffset() * 60000)
  .toISOString()
  .slice(0, 10);
dateInput.value = isoToday;

const storageKey = (profile, date) => `fitness-checkin:${profile}:${date}`;

function setStatus(message, tone = "") {
  statusEl.textContent = message;
  statusEl.className = `status ${tone}`.trim();
}

function textValue(data, key) {
  return String(data.get(key) || "").trim();
}

function getFormData() {
  const data = new FormData(form);
  return {
    profile: textValue(data, "profile"),
    date: textValue(data, "date"),
    completed: data.getAll("completed").map((v) => String(v).trim()),
    workoutMinutes: textValue(data, "workoutMinutes"),
    steps: textValue(data, "steps"),
    workoutDetails: textValue(data, "workoutDetails"),
    foodLog: textValue(data, "foodLog"),
    calories: textValue(data, "calories"),
    protein: textValue(data, "protein"),
    water: textValue(data, "water"),
    weight: textValue(data, "weight"),
    mood: textValue(data, "mood"),
    notes: textValue(data, "notes"),
    photo: photoInput.files?.[0] || null
  };
}

function fillForm(payload) {
  if (!payload) return;
  form.profile.value = payload.profile || "Josh";
  form.date.value = payload.date || isoToday;
  form.workoutMinutes.value = payload.workoutMinutes || "";
  form.steps.value = payload.steps || "";
  form.workoutDetails.value = payload.workoutDetails || "";
  form.foodLog.value = payload.foodLog || "";
  form.calories.value = payload.calories || "";
  form.protein.value = payload.protein || "";
  form.water.value = payload.water || "";
  form.weight.value = payload.weight || "";
  form.mood.value = payload.mood || "";
  form.notes.value = payload.notes || "";

  document.querySelectorAll('input[name="completed"]').forEach((checkbox) => {
    checkbox.checked = payload.completed?.includes(checkbox.value) || false;
  });
}

function saveLocal(showMessage = true) {
  const payload = getFormData();
  const { photo, ...safePayload } = payload;
  localStorage.setItem(storageKey(payload.profile, payload.date), JSON.stringify(safePayload));
  if (showMessage) setStatus("Saved on this device for today. Photos are not saved locally.", "good");
}

function loadLocal() {
  const key = storageKey(profileInput.value, dateInput.value);
  const raw = localStorage.getItem(key);
  if (!raw) return;

  try {
    fillForm(JSON.parse(raw));
    setStatus("Loaded saved check-in for this date.");
  } catch {
    setStatus("Could not load the saved check-in.", "bad");
  }
}

function escapeDiscord(value) {
  return String(value || "").replace(/[@`]/g, (m) => ({ "@": "@\u200b", "`": "\\`" }[m]));
}

function field(name, value, inline = true) {
  return { name, value: escapeDiscord(value || "Not logged").slice(0, 1000), inline };
}

async function sendToDiscord(payload) {
  const webhook = window.APP_CONFIG?.DISCORD_WEBHOOK_URL;
  if (!webhook || webhook.includes("PASTE_YOUR_DISCORD_WEBHOOK_URL_HERE")) {
    throw new Error("Set your Discord webhook in config.js first.");
  }

  if (payload.photo && payload.photo.size > 8 * 1024 * 1024) {
    throw new Error("That image is over 8 MB. Pick a smaller/compressed photo.");
  }

  const completedLines = payload.completed.length
    ? payload.completed.map((item) => `• ${escapeDiscord(item)}`).join("\n")
    : "None ticked";

  const profileColor = payload.profile === "Mae-Kay" ? 0xff76ba : 0x9b8cff;
  const profileIcon = payload.profile === "Mae-Kay" ? "🎀" : "💪";

  const embed = {
    title: `${profileIcon} ${escapeDiscord(payload.profile)} Daily Check-In`,
    color: profileColor,
    fields: [
      field("Date", payload.date || isoToday),
      field("Mood", payload.mood),
      field("Weight", payload.weight ? `${payload.weight} kg` : "Not logged"),
      field("Exercise", completedLines, false),
      field("Workout details", payload.workoutDetails || "Not logged", false),
      field("Minutes", payload.workoutMinutes),
      field("Steps", payload.steps),
      field("Food log", payload.foodLog || "Not logged", false),
      field("Calories", payload.calories),
      field("Protein", payload.protein ? `${payload.protein}g` : "Not logged"),
      field("Water", payload.water ? `${payload.water}L` : "Not logged")
    ],
    footer: { text: "Glow Check-In" },
    timestamp: new Date().toISOString()
  };

  if (payload.notes) {
    embed.fields.push(field("Notes", payload.notes, false));
  }

  if (payload.photo) {
    embed.image = { url: `attachment://${payload.photo.name}` };
  }

  const message = {
    username: "Glow Check-In",
    avatar_url: window.APP_CONFIG?.AVATAR_URL || undefined,
    embeds: [embed]
  };

  let body;
  let headers = {};

  if (payload.photo) {
    body = new FormData();
    body.append("payload_json", JSON.stringify(message));
    body.append("files[0]", payload.photo, payload.photo.name);
  } else {
    headers = { "Content-Type": "application/json" };
    body = JSON.stringify(message);
  }

  const response = await fetch(webhook, { method: "POST", headers, body });

  if (!response.ok) {
    let extra = "";
    try {
      const bodyText = await response.text();
      extra = bodyText ? ` ${bodyText}` : "";
    } catch {}
    throw new Error(`Discord webhook failed with ${response.status}.${extra}`.trim());
  }
}

saveBtn.addEventListener("click", () => saveLocal(true));
profileInput.addEventListener("change", loadLocal);
dateInput.addEventListener("change", loadLocal);
loadLocal();

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const payload = getFormData();
  const hasExercise = payload.completed.length || payload.workoutDetails || payload.workoutMinutes || payload.steps;
  const hasFood = payload.foodLog || payload.calories || payload.protein || payload.water;

  if (!hasExercise && !hasFood && !payload.weight && !payload.notes && !payload.photo) {
    setStatus("Add at least one thing before sending.", "bad");
    return;
  }

  submitBtn.disabled = true;
  setStatus(payload.photo ? "Sending check-in with photo..." : "Sending check-in...");

  try {
    await sendToDiscord(payload);
    saveLocal(false);
    setStatus("Check-in sent to Discord.", "good");
  } catch (error) {
    setStatus(error.message || "Could not send the check-in.", "bad");
  } finally {
    submitBtn.disabled = false;
  }
});
