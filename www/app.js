const API_BASE_URL = "https://YOUR-JARVIS-BACKEND.onrender.com";

const STORAGE = {
  conversation: "jarvis_v02_conversation",
  memories: "jarvis_v02_memories",
  tasks: "jarvis_v02_tasks"
};

const state = {
  conversation: load(STORAGE.conversation, []),
  memories: load(STORAGE.memories, []),
  tasks: load(STORAGE.tasks, []),
  listening: false
};

const conversationEl = document.getElementById("conversation");
const inputEl = document.getElementById("messageInput");
const sendButton = document.getElementById("sendButton");
const voiceButton = document.getElementById("voiceButton");
const voiceStatus = document.getElementById("voiceStatus");
const memoryList = document.getElementById("memoryList");
const taskList = document.getElementById("taskList");

function load(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function addMessage(role, content, persist = true) {
  const message = document.createElement("div");

  message.className = `message ${role}`;

  message.textContent = content;

  conversationEl.appendChild(message);

  conversationEl.scrollTop = conversationEl.scrollHeight;

  if (persist && (role === "user" || role === "assistant")) {
    state.conversation.push({
      role,
      content,
      timestamp: Date.now()
    });

    state.conversation = state.conversation.slice(-40);

    save(STORAGE.conversation, state.conversation);
  }
}

function addTyping() {
  const message = document.createElement("div");

  message.className = "message assistant";
  message.id = "typingMessage";

  message.innerHTML = `
    <div class="typing">
      <span></span>
      <span></span>
      <span></span>
    </div>
  `;

  conversationEl.appendChild(message);

  conversationEl.scrollTop = conversationEl.scrollHeight;
}

function removeTyping() {
  document.getElementById("typingMessage")?.remove();
}

function renderConversation() {
  conversationEl.innerHTML = "";

  if (!state.conversation.length) {
    addMessage(
      "system",
      "JARVIS v0.2 online. Your personal AI brain is ready.",
      false
    );

    addMessage(
      "assistant",
      "Hello. I am JARVIS. What would you like to work on?",
      false
    );

    return;
  }

  for (const message of state.conversation) {
    addMessage(
      message.role === "user" ? "user" : "assistant",
      message.content,
      false
    );
  }
}

function renderMemories() {
  memoryList.innerHTML = "";

  if (!state.memories.length) {
    memoryList.innerHTML = `
      <div class="empty-state">
        No memories stored yet.
      </div>
    `;
  } else {
    for (const memory of state.memories) {
      const item = document.createElement("div");

      item.className = "memory-item";
      item.textContent = memory.text;

      memoryList.appendChild(item);
    }
  }

  document.getElementById("memoryCount").textContent =
    state.memories.length;
}

function renderTasks() {
  taskList.innerHTML = "";

  if (!state.tasks.length) {
    taskList.innerHTML = `
      <div class="empty-state">
        No tasks yet.
      </div>
    `;
  } else {
    for (const task of state.tasks) {
      const item = document.createElement("div");

      item.className =
        "task-item" + (task.completed ? " completed" : "");

      item.innerHTML = `
        <button
          class="task-check"
          data-task-id="${task.id}"
        >
          ${task.completed ? "✓" : ""}
        </button>

        <span class="task-text">
          ${escapeHTML(task.text)}
        </span>
      `;

      taskList.appendChild(item);
    }
  }

  const activeTasks =
    state.tasks.filter(task => !task.completed).length;

  document.getElementById("taskCount").textContent = activeTasks;
}

function remember(text) {
  state.memories.push({
    id: crypto.randomUUID(),
    text,
    createdAt: Date.now()
  });

  save(STORAGE.memories, state.memories);

  renderMemories();
}

function createTask(text) {
  state.tasks.push({
    id: crypto.randomUUID(),
    text,
    completed: false,
    createdAt: Date.now()
  });

  save(STORAGE.tasks, state.tasks);

  renderTasks();
}

function completeTask(id) {
  const task = state.tasks.find(item => item.id === id);

  if (!task) {
    return;
  }

  task.completed = !task.completed;

  save(STORAGE.tasks, state.tasks);

  renderTasks();
}

function clearConversation() {
  state.conversation = [];

  save(STORAGE.conversation, state.conversation);

  renderConversation();
}

function speak(text) {
  if (!("speechSynthesis" in window)) {
    return;
  }

  window.speechSynthesis.cancel();

  const cleanText = text
    .replace(/[*_`#]/g, "")
    .slice(0, 1800);

  const utterance = new SpeechSynthesisUtterance(cleanText);

  utterance.rate = 1;
  utterance.pitch = 0.95;
  utterance.volume = 1;

  window.speechSynthesis.speak(utterance);
}

function localCommand(message) {
  const lower = message.toLowerCase().trim();

  if (
    lower.includes("what can you do") ||
    lower === "capabilities"
  ) {
    return `
I can currently:

• Have natural AI conversations
• Remember information locally
• Manage tasks
• Calculate expressions
• Tell you the current time and date
• Understand voice input
• Read responses aloud
• Maintain conversation context

More tools are being added to JARVIS.
    `.trim();
  }

  if (
    lower.includes("what time is it") ||
    lower === "time"
  ) {
    return new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  if (lower.includes("what date is it")) {
    return new Date().toLocaleDateString([], {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  }

  const rememberMatch =
    message.match(
      /^(?:remember that|remember|save this)\s+(.+)/i
    );

  if (rememberMatch) {
    const memory = rememberMatch[1].trim();

    remember(memory);

    return `I've stored that in your local JARVIS memory:\n"${memory}"`;
  }

  const taskMatch =
    message.match(
      /^(?:add task|create task|remind me to)\s+(.+)/i
    );

  if (taskMatch) {
    const task = taskMatch[1].trim();

    createTask(task);

    return `Task created:\n"${task}"`;
  }

  if (
    lower === "show my tasks" ||
    lower === "list my tasks"
  ) {
    if (!state.tasks.length) {
      return "You don't have any tasks yet.";
    }

    return state.tasks
      .map(
        (task, index) =>
          `${index + 1}. ${
            task.completed ? "✓" : "○"
          } ${task.text}`
      )
      .join("\n");
  }

  if (
    lower === "show my memories" ||
    lower === "list my memories"
  ) {
    if (!state.memories.length) {
      return "You don't have any stored memories yet.";
    }

    return state.memories
      .map(
        (memory, index) =>
          `${index + 1}. ${memory.text}`
      )
      .join("\n");
  }

  const calculatorMatch =
    message.match(
      /^(?:calculate|calc)\s+(.+)/i
    );

  if (calculatorMatch) {
    return calculate(calculatorMatch[1]);
  }

  return null;
}

function calculate(expression) {
  const cleaned = expression
    .replaceAll("×", "*")
    .replaceAll("÷", "/")
    .replaceAll("^", "**")
    .trim();

  if (!/^[0-9+\-*/%().\s*]+$/.test(cleaned)) {
    return "I can only calculate basic arithmetic expressions here.";
  }

  try {
    const result = Function(
      `"use strict"; return (${cleaned})`
    )();

    if (!Number.isFinite(result)) {
      return "That calculation does not produce a finite number.";
    }

    return `Result: ${result}`;
  } catch {
    return "I couldn't calculate that expression.";
  }
}

async function askAI(message) {
  const response = await fetch(
    `${API_BASE_URL}/api/chat`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message,
        conversation: state.conversation
          .slice(-20)
          .map(item => ({
            role: item.role,
            content: item.content
          }))
      })
    }
  );

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(
      data.error ||
      "JARVIS backend returned an error."
    );
  }

  return data.reply;
}

async function sendMessage(text = null) {
  const message =
    text !== null
      ? text.trim()
      : inputEl.value.trim();

  if (!message) {
    return;
  }

  inputEl.value = "";

  inputEl.style.height = "auto";

  addMessage("user", message);

  const local = localCommand(message);

  if (local) {
    addMessage("assistant", local);
    speak(local);
    return;
  }

  addTyping();

  sendButton.disabled = true;

  try {
    const reply = await askAI(message);

    removeTyping();

    addMessage("assistant", reply);

    speak(reply);
  } catch (error) {
    removeTyping();

    addMessage(
      "assistant",
      `I couldn't reach my AI brain.\n\n${error.message}`
    );
  } finally {
    sendButton.disabled = false;
  }
}

function setupVoiceRecognition() {
  const Recognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

  if (!Recognition) {
    voiceButton.addEventListener("click", () => {
      voiceStatus.textContent =
        "Voice recognition isn't available on this device.";
    });

    return;
  }

  const recognition = new Recognition();

  recognition.lang = "en-IN";
  recognition.interimResults = true;
  recognition.continuous = false;

  recognition.onstart = () => {
    state.listening = true;
    voiceStatus.textContent = "LISTENING...";
    voiceButton.style.boxShadow =
      "0 0 25px rgba(103,223,255,.25)";
  };

  recognition.onresult = event => {
    let transcript = "";

    for (
      let i = event.resultIndex;
      i < event.results.length;
      i++
    ) {
      transcript += event.results[i][0].transcript;
    }

    inputEl.value = transcript;
  };

  recognition.onerror = event => {
    voiceStatus.textContent =
      `Voice error: ${event.error}`;
  };

  recognition.onend = () => {
    state.listening = false;

    voiceStatus.textContent = "";

    voiceButton.style.boxShadow = "";
  };

  voiceButton.addEventListener("click", () => {
    if (state.listening) {
      recognition.stop();
      return;
    }

    recognition.start();
  });
}

sendButton.addEventListener(
  "click",
  () => sendMessage()
);

inputEl.addEventListener("keydown", event => {
  if (
    event.key === "Enter" &&
    !event.shiftKey
  ) {
    event.preventDefault();

    sendMessage();
  }
});

inputEl.addEventListener("input", () => {
  inputEl.style.height = "auto";
  inputEl.style.height =
    `${Math.min(inputEl.scrollHeight, 130)}px`;
});

document
  .getElementById("clearChatButton")
  .addEventListener(
    "click",
    clearConversation
  );

document
  .querySelectorAll(".quick-card")
  .forEach(button => {
    button.addEventListener("click", () => {
      sendMessage(button.dataset.command);
    });
  });

taskList.addEventListener("click", event => {
  const button =
    event.target.closest(".task-check");

  if (!button) {
    return;
  }

  completeTask(button.dataset.taskId);
});

setupVoiceRecognition();

renderConversation();
renderMemories();
renderTasks();
