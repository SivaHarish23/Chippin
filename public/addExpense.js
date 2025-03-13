let currentUserId = null;
let currentUserName = null;
let currentUserFullName = null;
let currentGroupId = null;
let groupMembers = null;
document.addEventListener("DOMContentLoaded", async function () {

    currentUserId = sessionStorage.getItem("userId");
    currentUserName = sessionStorage.getItem("username");
    currentUserFullName = sessionStorage.getItem("userFullName");
    console.log("currentUser : " + currentUserId + " | " + currentUserName + " | " + currentUserFullName);

    const groupSelect = document.getElementById("groupSelect");

    console.log("fetching groups");
    showLoading(); // Show loading screen
    try {
        const response = await fetch(`/groups/loadGroups?userId=${currentUserId}`);
        const groups = await response.json();

        // Clear the dropdown and add a default option
        groupSelect.innerHTML = '<option value="" disabled selected>Select a group</option>';

        // Populate dropdown with group names
        groups.forEach(group => {
            const option = document.createElement("option");
            option.value = group.id;  // Store group ID in value
            option.textContent = group.group_name;
            groupSelect.appendChild(option);
        });

    } catch (error) {
        console.error("Error fetching groups:", error);
        groupSelect.innerHTML = '<option value="" disabled selected>Error loading groups</option>';
    } finally {
        hideLoading(); // Hide loading screen
    }

    // Log the selected group ID when the selection changes
    groupSelect.addEventListener("change", async function () {
        currentGroupId = this.value;
        console.log("Selected Group ID:", currentGroupId);
        sessionStorage.setItem('group_id', currentGroupId);
        
        console.log("fetching group members");
        showLoading();

        try {
            const response = await fetch(`/groups/loadGroupMembers?group_id=${currentGroupId}`);
            groupMembers = await response.json();

            console.log(groupMembers);

        } catch (error) {
            console.error("Error fetching groups members:", error);
            alert("Error fetching group members : " + error);
        } finally {
            hideLoading(); // Hide loading screen
        }
    });

    document.querySelectorAll('input[name="splitType"]').forEach(radio => {
        radio.addEventListener('change', function () {
            const splitType = this.value;
            document.getElementById('splitTableContainer').classList.toggle('hidden', splitType === 'none');
            generateSplitTable(splitType);
        });
    });

    attachSplitTypeListener();
});


function generateSplitTable(splitType) {
    let members = ['You', 'Alice', 'Bob', 'Charlie']; // Example members, fetch dynamically

    console.log(currentUserId);
    // Separate the current user
    const currentUser = groupMembers.find(user => user.user_id == currentUserId);
    const otherUsers = groupMembers.filter(user => user.user_id != currentUserId);
    console.log(currentUser);
    console.log([currentUser, ...otherUsers]);
    // Combine current user on top
    const sortedUsers = [currentUser, ...otherUsers].map(user => user.name);

    console.log(sortedUsers);
    members = sortedUsers;

    const splitTableHead = document.querySelector('#splitTable thead tr');
    const splitTableBody = document.getElementById('splitTableBody');

    // Clear existing table
    splitTableBody.innerHTML = '';
    splitTableBody.innerHTML = splitTableHeadSwitch(splitType);

    members.forEach((member, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><input type="checkbox" class="member-checkbox" ></td>
            <td class="member-name">${member}</td>
            <td><input type="number" class="per-share" value="0" ${splitType === 'equal' || splitType === 'percentage' ? 'readonly' : ''}></td>
            ${splitType === 'percentage' ? `<td><input type="number" class="percentage" value="0" ${splitType !== 'percentage' ? 'readonly' : ''}></td>` : ''}
            ${splitType !== 'equal' ? `<td><button type="button" class="lock-btn"> 🔓 </button></td>` : ''}
        
        `;
        splitTableBody.appendChild(row);
    });

    document.querySelectorAll('.member-checkbox').forEach((checkbox, index) => {
        if (index !== 0) {
            checkbox.addEventListener('change', function () {
                toggleRowInputs(checkbox.closest('tr'), checkbox.checked);
                reorderTable();
                console.log(checkbox.checked);
                distributeEqualSplit();
            });
        }

    });

    // disable all the begining
    document.querySelectorAll('.member-checkbox').forEach((checkbox, index) => {
        if (index !== 0) {
            toggleRowInputs(checkbox.closest('tr'),);
        }
    });
    // enable top row alone
    const firstCheckbox = document.querySelector('.member-checkbox');
    if (firstCheckbox) {
        firstCheckbox.checked = true;
        firstCheckbox.disabled = true; // Prevent user from unchecking it
        toggleRowInputs(firstCheckbox.closest('tr'), true); // Always enable the first row
    }



    document.querySelectorAll('.lock-btn').forEach(btn => {
        btn.addEventListener('click', function () {

            let lockedRows = document.querySelectorAll('.per-share[readonly]').length;
            let totalSelectedRows = document.querySelectorAll('.member-checkbox:checked').length;
            console.log("lockedRows : " + lockedRows);
            console.log("totalSelectedRows : " + totalSelectedRows);

            const row = this.closest('tr');
            const shareInput = row.querySelector('.per-share');

            if (shareInput.hasAttribute('readonly') || lockedRows < totalSelectedRows - 2) {
                if (document.querySelector('input[name="splitType"]:checked').value === 'custom') {
                    shareInput.toggleAttribute('readonly');
                    this.textContent = shareInput.hasAttribute('readonly') ? '🔒' : '🔓';
                }

            }
            else {
                alert("All selected rows can't be locked! Req: Atleast 2 unlocked rows...");
            }


            if (shareInput.hasAttribute('readonly') && document.querySelector('input[name="splitType"]:checked').value === 'custom') {
                // distributeCustomSplit();
                console.log("shared input value : " + shareInput.value);
                console.log("shared input : " + shareInput);
                adjustCustomSplitWithLocks(shareInput);
            }

        });
    });
}


function splitTableHeadSwitch(splitType) {
    let tableHead = ``;
    if (splitType === 'equal') {
        tableHead = `
        <th>Select</th>
        <th>Member</th>
        <th>Per Share (Rs)</th>
        `;
    }
    else if (splitType === 'custom') {
        tableHead = `
        <th>Select</th>
        <th>Member</th>
        <th>Per Share (Rs)</th>
        <th>Lock</th>
        `;
    }
    else if (splitType === 'percentage') {
        tableHead = `
        <th>Select</th>
        <th>Member</th>
        <th>Per Share (Rs)</th>
        <th>%</th>
        <th>Lock</th>
        `;
    }
    return tableHead;
}


document.getElementById('selectAll').addEventListener('click', function () {
    document.querySelectorAll('.member-checkbox').forEach((checkbox, index) => {
        if (index !== 0) {
            checkbox.checked = true; // Select all except the first row
            toggleRowInputs(checkbox.closest('tr'), true);
        }
    });
    reorderTable();
    if (document.querySelector('input[name="splitType"]:checked')?.value === 'equal') {
        distributeEqualSplit();
    }
    if (document.querySelector('input[name="splitType"]:checked')?.value === 'custom') {
        distributeCustomSplit();
    }
    if (document.querySelector('input[name="splitType"]:checked')?.value === 'percentage') {

    }
});

document.getElementById('deselectAll').addEventListener('click', function () {
    document.querySelectorAll('.member-checkbox').forEach((checkbox, index) => {
        if (index !== 0) {
            checkbox.checked = false; // Deselect all except the first row
            toggleRowInputs(checkbox.closest('tr'), false);
        }
    });
    reorderTable();
    if (document.querySelector('input[name="splitType"]:checked')?.value === 'equal') {
        distributeEqualSplit();
    }
    if (document.querySelector('input[name="splitType"]:checked')?.value === 'custom') {
        distributeCustomSplit();
    }
    if (document.querySelector('input[name="splitType"]:checked')?.value === 'percentage') {
        adjustCustomSplitWithLocks();
    }
});

// Function to enable/disable inputs and buttons in a row
function toggleRowInputs(row, isEnabled) {
    row.querySelectorAll('input, button').forEach(element => {
        if (!element.classList.contains('member-checkbox')) {
            element.disabled = !isEnabled;
            if (!isEnabled && element.classList.contains('per-share')) {
                element.value = "0";  // Set to 0 when deselected
            }
        }
    });
}

function reorderTable() {
    const tableBody = document.getElementById('splitTableBody');
    const rows = Array.from(tableBody.querySelectorAll('tr'));

    // Keep the first row at the top
    const firstRow = rows.shift();

    // Separate selected and unselected rows
    const selectedRows = rows.filter(row => row.querySelector('.member-checkbox').checked);
    const unselectedRows = rows.filter(row => !row.querySelector('.member-checkbox').checked);

    // Rebuild the table with the first row at the top, followed by selected rows, then unselected rows
    tableBody.innerHTML = '';
    tableBody.appendChild(firstRow);
    selectedRows.forEach(row => tableBody.appendChild(row));
    unselectedRows.forEach(row => tableBody.appendChild(row));
}




function attachSplitTypeListener() {
    document.querySelectorAll('input[name="splitType"]').forEach(radio => {
        radio.addEventListener('change', function () {
            if (this.value === 'equal') {
                distributeEqualSplit();
            }
            if (this.value === 'custom') {
                distributeCustomSplit();
            }
        });
    });

    document.getElementById('amount').addEventListener('input', function () {
        if (document.querySelector('input[name="splitType"]:checked').value === 'equal') {
            distributeEqualSplit();
        }
        if (document.querySelector('input[name="splitType"]:checked').value === 'custom') {
            distributeCustomSplit();
        }
    });
}

function distributeEqualSplit() {
    const amount = parseFloat(document.getElementById('amount').value) || 0;
    const checkedRows = Array.from(document.querySelectorAll('.member-checkbox:checked'))
        .map(checkbox => checkbox.closest('tr'));

    if (checkedRows.length > 0) {
        const equalShare = (amount / checkedRows.length).toFixed(2);

        checkedRows.forEach(row => {
            row.querySelector('.per-share').value = equalShare; // Assuming the Per Share input has class `per-share`
        });
    }
}

function distributeCustomSplit() {
    let amount = parseFloat(document.getElementById('amount').value) || 0;
    let selectedRows = Array.from(document.querySelectorAll('.member-checkbox:checked'))
        .map(checkbox => checkbox.closest('tr'));

    if (selectedRows.length === 0) return;

    let equalShare = (amount / selectedRows.length).toFixed(2);

    selectedRows.forEach(row => {
        let input = row.querySelector('.per-share');
        if (input) {
            input.value = equalShare;
            // input.disabled = false; // Make inputs editable
        }
    });

    attachCustomSplitListeners();
}

function attachCustomSplitListeners() {
    document.querySelectorAll('.per-share').forEach(input => {
        input.addEventListener('input', adjustCustomSplitWithLocks);
    });
}

function adjustCustomSplit(event) {
    let amount = parseFloat(document.getElementById('amount').value) || 0;
    let selectedRows = Array.from(document.querySelectorAll('.member-checkbox:checked'))
        .map(checkbox => checkbox.closest('tr'));
    if (selectedRows.length === 0) return;
    let editedInput = event.target;
    let remainingRows = selectedRows.filter(row => row.querySelector('.per-share') !== editedInput);
    let remainingAmount = amount - parseFloat(editedInput.value || 0);
    let remainingShare = (remainingAmount / remainingRows.length).toFixed(2);
    remainingRows.forEach(row => {
        let input = row.querySelector('.per-share');
        if (input) {
            input.value = remainingShare;
        }
    });
}
function adjustCustomSplitWithLocks(event) {
    let amount = parseFloat(document.getElementById('amount').value) || 0;
    let selectedRows = Array.from(document.querySelectorAll('.member-checkbox:checked'))
        .map(checkbox => checkbox.closest('tr'));

    if (selectedRows.length === 0) return;
    console.log("event.target : " + event.target);
    console.log("event : " + event);
    let editedInput = event.target || event;
    let remainingRows = selectedRows.filter(row => row.querySelector('.per-share') !== editedInput);

    let lockedRows = remainingRows.filter(row => row.querySelector('.per-share').readOnly);
    let unlockedRows = remainingRows.filter(row => !row.querySelector('.per-share').readOnly);

    let lockedAmount = lockedRows.reduce((sum, row) => sum + parseFloat(row.querySelector('.per-share').value || 0), 0);
    let remainingAmount = amount - lockedAmount - editedInput.value;

    let equalShare = (remainingAmount / unlockedRows.length).toFixed(2);

    unlockedRows.forEach(row => {
        let input = row.querySelector('.per-share');
        if (input) {
            input.value = equalShare;
        }
    });
}

document.getElementById("log-expense-btn").addEventListener("click", async function (event) {
    event.preventDefault(); // Prevent form submission for validation

    let selectedGroup = document.getElementById("groupSelect").value; // Assuming a dropdown for group selection
    let amount = document.getElementById("amount").value.trim();
    let description = document.getElementById("description").value.trim();
    let category = document.getElementById("category").value.trim();
    let splitType = document.querySelector('input[name="splitType"]:checked').value;

    // Regular Expression to check for disallowed symbols
    let invalidChars = /[:{}]/;

    // Validate inputs
    if (!selectedGroup || selectedGroup === "none") {
        alert("Please select a group before logging an expense.");
        return;
    }
    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
        alert("Please enter a valid amount.");
        return;
    }
    if (!description || invalidChars.test(description)) {
        alert("Invalid description. Do not use symbols like ':', '{', '}'.");
        return;
    }
    if (!category || invalidChars.test(category)) {
        alert("Invalid category. Do not use symbols like ':', '{', '}'.");
        return;
    }

    let splitDetails = [];
    let splitSummary = "";

    if (splitType !== "none") {
        let rows = document.querySelectorAll("#splitTable tbody tr");

        rows.forEach(row => {
            let checkbox = row.querySelector(".member-checkbox");
            if (checkbox && checkbox.checked) {
                let username = row.querySelector(".member-name").textContent.trim();
                let perShare = row.querySelector(".per-share").value.trim();

                // Find the user_id from the groupMembers array
                let user = groupMembers.find(member => member.name === username);

                if (!user) {
                    console.error(`User not found for username: ${username}`);
                    return;
                }

                if (!perShare || isNaN(perShare) || parseFloat(perShare) < 0) {
                    alert(`Invalid per-share amount for ${username}.`);
                    return;
                }

                splitDetails.push({
                    'user_id': user.user_id,
                    'name': user.name,
                    'username': username,
                    'per_share': parseFloat(perShare)
                });

                splitSummary += `${user.name}: ₹${parseFloat(perShare).toFixed(2)}\n`;
            }
        });

        if (splitDetails.length === 0) {
            alert("At least one member must be selected for splitting.");
            return;
        }
    }

    // 🔴 **Step 3: Show Confirmation Popup**
    let summaryMessage = `
🔹 **Expense Summary** 🔹
---------------------------------
💰 Amount: ₹${parseFloat(amount).toFixed(2)}
📝 Description: ${description}
📂 Category: ${category}
👤 Paid By: ${currentUserFullName}  ✅
📊 Split Type: ${splitType}

👥 Split Details:
${splitSummary ? splitSummary : "Not Applicable"}

❓ Do you want to log this expense?
`;

    let confirmLog = confirm(summaryMessage);

    if (!confirmLog) {
        alert("Expense logging cancelled. You can edit the details.");
        return;
    }



    let specialMessage = `
🔹 **Expense Summary** 🔹
---------------------------------
💰 Amount: ₹${parseFloat(amount).toFixed(2)}
📝 Description: ${description}
📂 Category: ${category}
👤 Paid By: ${currentUserFullName}  ✅
📊 Split Type: ${splitType}

👥 Split Details:
${splitSummary ? splitSummary : "Not Applicable"}
`;

    const message = {
        user_id: currentUserId,
        group_id: currentGroupId,
        message: specialMessage,
        type: 'special'
    };

    // Create the request body
    const expenseData = {
        amount: parseFloat(amount).toFixed(2),
        description,
        category,
        group_id: currentGroupId,
        paid_by: currentUserId,
        split_type: splitType,
        split_details: splitDetails
    };

    showLoading();
    try {
        const chatResponse = await fetch("/chat/send", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(message)
        })
        const chatResult = await chatResponse.json();
        if (chatResponse.ok) {
            const chat_id = chatResult.chat.id;
            expenseData.chat_id = chat_id;

            const response = await fetch("/expense/logExpense", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(expenseData)
            });
            const result = await response.json();
        if (response.ok) {
            alert("✅ Expense logged successfully!");
            // window.location.reload(); // Refresh the page or redirect if needed
            
        } else {
            alert("Error: " + result.error);
        }
        }

    } catch (error) {
        console.error("Error logging expense:", error);
        alert("Something went wrong! Please try again. : " + error);
    } finally {
        hideLoading();
        window.location.reload();
    }

});
