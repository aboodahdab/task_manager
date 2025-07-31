const $btn = document.querySelector("#add_task");
const $add_tasks_div = document.querySelector("#add_task_div");
const $add_new_task_btn = document.querySelector("#add_task_btn");
const $task_name_input = document.querySelector("#task_name_input");
const $task_date_input = document.querySelector("#task_due_date_input");
const $task_status_option = document.querySelector("#task_status");
const $error_paragraph = document.querySelector("#task_error_p");
const $error_div = document.querySelector("#task_error_div");
const $tasks_div = document.querySelector("#tasks_div");
let isEditing = false;
let editingTaskId = null;
const date = new Date();
date.setHours(0, 0, 0, 0);
document.addEventListener("DOMContentLoaded", () => {
  const main = document.querySelector("main");
  const sidebar = document.getElementById("sidebar");

  main.addEventListener("click", () => {
    // Hide sidebar only on small screens
    if (
      window.innerWidth < 768 &&
      !sidebar.classList.contains("-translate-x-full")
    ) {
      sidebar.classList.add("-translate-x-full");
    }
  });
});
$btn.addEventListener("click", () => $add_tasks_div.classList.remove("hidden"));

$task_date_input.addEventListener("change", () => {
  let input_date = new Date($task_date_input.value);
  const not_statred = $task_status_option.querySelector("#option3");
  const in_progress = $task_status_option.querySelector("#option2");

  if (input_date < date) {
    not_statred.disabled = true;
    in_progress.disabled = true;
    $task_status_option.value = "overdue";
    showTaskError("please add a future date or task status set to overdue");
  } else {
    not_statred.disabled = false;
    in_progress.disabled = false;
  }
});
$add_new_task_btn.addEventListener("click", async () => {
  const name = $task_name_input.value.trim();
  const due = $task_date_input.value.trim();
  let status = $task_status_option.value.trim();

  if (check(name, due, status) == false) {
    console.log("welcome sti;");
    return showTaskError("Please fill in all fields.");
  }
  if (name.length > 75) {
    return showTaskError("Too long task name (maxmium 75 !");
  }
  if (new Date(due) < date) {
    status = "overdue";
  }

  if (isEditing) {
    editTask(editingTaskId, name, due, status);

    isEditing = false;
    editingTaskId = null;

    $add_new_task_btn.textContent = "Add Task";
    $add_new_task_btn.classList.remove("bg-yellow-500", "hover:bg-yellow-600");
    $add_new_task_btn.classList.add("bg-blue-600", "hover:bg-blue-700");

    toggleAddTaskModal();
    showTaskError("Task updated successfully!");
    $error_paragraph.style.color = "green";

    setTimeout(() => {
      $error_paragraph.textContent = "";
      $error_paragraph.style.color = "red";
    }, 2000);

    return;
  }

  try {
    const response = await fetch("/task", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        task_name: name,
        task_date: due,
        task_status: status,
      }),
    });

    const result = await response.json();

    if (result.status !== "success")
      return showTaskError(result.message || "Failed to add task");

    const task = result.task;
    $tasks_div.innerHTML += makeTasksHtml(task);

    $task_name_input.value = "";
    $task_date_input.value = "";
    $task_status_option.value = "";
    $task_status_option
      .querySelectorAll("option")
      .forEach((opt) => (opt.disabled = false));

    showTaskError("Task added successfully!");
    $error_paragraph.style.color = "green";

    setTimeout(() => toggleAddTaskModal(), 1200);
    setTimeout(() => {
      $error_paragraph.textContent = "";
      $error_paragraph.style.color = "red";
    }, 2000);
  } catch (err) {
    console.log(err);
    showTaskError("Server error. Please try again.");
  }
});

function makeTasksHtml(task) {
  let statusColor = "bg-yellow-100 text-yellow-700";
  if (task.status.toLowerCase() === "overdue")
    statusColor = "bg-red-100 text-red-700";
  if (task.status.toLowerCase() === "not started")
    statusColor = "bg-cyan-100 text-green-700";
  console.log(task, "task");
  task_date = new Date(task.date);
  if (task_date < date) {
    task.status = "overdue";
    statusColor = "bg-red-100 text-red-700";
  }
  return `
  <div class="task-card bg-white p-4 rounded-lg shadow flex justify-between items-center mb-4 relative group" data-id="${task._id}">
    <div class="flex items-center space-x-4">
      <input type="checkbox" class="w-5 h-5 text-blue-600" />
      <div>
<h3 class="font-semibold text-gray-800 break-all max-w-xs">
  ${task.name}
</h3>
        <p class="text-sm text-gray-500">Due: ${task.date}</p>
      </div>
    </div>

    <div class="flex items-center space-x-2">
      <span class="${statusColor} px-3 py-1 rounded-full text-sm">${task.status}</span>
      <div class="relative">
        <button class="text-gray-600 hover:text-gray-900 focus:outline-none" onclick="toggleDropdown(this)">⋮</button>
        <div class="absolute right-0 mt-2 w-28 bg-white border border-gray-200 rounded-lg shadow-lg hidden z-50">
          <div class="flex justify-end px-2 pt-2">
            <button onclick="toggleDropdown(this.closest('.relative').querySelector('button'))" class="text-gray-500 hover:text-gray-800 text-sm">✕</button>
          </div>
          <button class="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" id="editBtn">Edit</button>
          <button class="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-100" id="delBtn">Delete</button>
        </div>
      </div>
    </div>
  </div>
  `;
}

$tasks_div.addEventListener("click", (e) => {
  if (e.target.id === "editBtn") {
    const taskCard = e.target.closest(".task-card");

    const taskNameElement = taskCard?.querySelector("h3");
    if (taskNameElement) {
      console.log("Edit clicked for:", taskNameElement.textContent);
      showEditForm(taskCard);
    }
  }

  if (e.target.id === "delBtn") {
    const taskCard = e.target.closest(".task-card");
    const taskId = taskCard?.dataset.id;
    const taskNameElement = taskCard?.querySelector("h3");
    if (taskCard && taskNameElement) {
      console.log("Deleting:", taskNameElement.textContent);
      console.log(taskId);
      delTask(taskId);
      taskCard.remove();
    }
  }
});
async function delTask(id) {
  await fetch("/deltask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      task_id: id,
    }),
  });
}
function showTaskError(msg) {
  $error_paragraph.textContent = msg;
  $error_div.classList.remove("hidden");
  setTimeout(() => {
    $error_div.classList.add("hidden");
  }, 4500);
}
function editTask(id, task_name, due, status) {
  fetch("/edittask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      task_id: id,
      task_name: task_name,
      task_date: due,
      task_status: status,
    }),
  });
}
function toggleAddTaskModal() {
  $add_tasks_div.classList.toggle("hidden");
}

function check(v1, v2, v3) {
  if (v1 !== "" && v2 !== "" && v3 !== "") {
    return true;
  }
  return false;
}

function toggleDropdown(button) {
  const dropdown = button.nextElementSibling;
  dropdown.classList.toggle("hidden");
}
function showEditForm(taskCard) {
  const taskId = taskCard.dataset.id;
  const name = taskCard.querySelector("h3").textContent.trim();
  const dateText = taskCard
    .querySelector("p")
    .textContent.trim()
    .replace("Due: ", "");
  const status = taskCard
    .querySelector("span")
    .textContent.trim()
    .toLowerCase()
    .replace(" ", "-");

  $task_name_input.value = name;
  $task_date_input.value = dateText;
  $task_status_option.value = status;

  isEditing = true;
  editingTaskId = taskId;
  $add_new_task_btn.textContent = "Save Changes";
  $add_new_task_btn.classList.remove("bg-blue-600", "hover:bg-blue-700");
  $add_new_task_btn.classList.add("bg-yellow-500", "hover:bg-yellow-600");

  $add_tasks_div.classList.remove("hidden");
}

window.onload = getTasks;
function getTasks() {
  fetch("/gettask")
    .then((res) => res.ok && res.json())
    .then((data) => {
      $tasks_div.innerHTML = "";
      data.tasks.forEach((task) => {
        $tasks_div.innerHTML += makeTasksHtml(task);
      });
    })
    .catch((e) => console.error("Error fetching tasks:", e));
}
function check(val1, val2, val3) {
  let result = {};
  if (val1) {
    result["task_name"] = val1;
    console.log(result);
  }
  //  if (val2) {
  //   result[""]=
  // }
  if (val3 != "all-statuses") {
    result["task_status"] = val3;
  }
}
function get_filterd_tasks(name, date, status) {
  if (check(name, date, status)) {
    my_query = check(name, date, status);
    fetch("/", {
      method: "post",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        my_query,
      }),
    });
  }
}
