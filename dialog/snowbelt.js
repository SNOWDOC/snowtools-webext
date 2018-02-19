const context = {
    tabCount: 0,
    tabs: {}, // array of tabs
    urlFilters: "",
    knownInstances: {}, // { "url1" : "instance 1 name", "url2" : "instnce 2 name", ...}
    knownNodes: {} // { "url1" : ["node1","node2", ...], "url2" : ...}
};

/**
 * Switches to the tab that has the same id as the event target
 * @param {object} evt the event that triggered the action
 */
function switchTab (evt) {
    chrome.tabs.update(parseInt(evt.target.id), {active: true});
}

/**
 * Creates a new tab and opens the url stored in the value of the event target
 * @param {object} evt the event that triggered the action
 */
function newTab (evt) {
    let targetUrl = evt.target.value;
    chrome.tabs.create({ url: targetUrl });
}

/**
 * Starts scanning the instance nodes
 * @param {object} evt the event that triggered the action
 */
function scanNodes (evt) {
    let targetInstance = evt.target.getAttribute("data-instance");
    let id = context.tabs[targetInstance][0].id; // we will ask the first tab found for the target instance to scan the nodes
    document.querySelector("li[data-instance=\"" + targetInstance + "\"]").classList.add("loading");
    chrome.tabs.sendMessage(id, {"command": "scanNodes"}, function (response) {
        document.querySelector("li[data-instance=\"" + targetInstance + "\"]").classList.remove("loading");
        if (response && response.status === 200 && response.nodes !== undefined && response.nodes.length > 0) {
            let nodes = response.nodes;
            nodes.sort();
            saveNodes(targetInstance, nodes);
            refreshNodes(targetInstance, response.current);
        } else if (response.status !== 200) {
            let nodes = ["Got http status " + response.status];
            saveNodes(targetInstance, nodes);
            refreshNodes(targetInstance, response.current);
        }
    });
}

/**
 * Saves nodes in local storage
 * @param {String} instanceName fqdn of target instance
 * @param {Array} nodes array of nodes names
 */
function saveNodes (instanceName, nodes) {
    context.knownNodes[instanceName] = nodes;
    if (typeof (Storage) !== "undefined") {
        localStorage.knownNodes = JSON.stringify(context.knownNodes);
    }
}

/**
 * Saves the known instances; called after the open tabs have been parsed
 */
function saveKnownInstances () {
    if (typeof (Storage) !== "undefined") {
        localStorage.knownInstances = JSON.stringify(context.knownInstances);
    }
}

/**
 * Retrieves saved options
 */
function getOptions () {
    context.urlFilters = "service-now.com";
    context.knownInstances = {};
    context.knownNodes = {};
    if (typeof (Storage) !== "undefined") {
        context.urlFilters = localStorage.urlFilters || "service-now.com";
        try {
            context.knownInstances = JSON.parse(localStorage.knownInstances);
        } catch (e) {
            // could not parse the saved data, perhaps someone messed with it
            context.knownInstances = {};
        }
        try {
            context.knownNodes = JSON.parse(localStorage.knownNodes);
        } catch (e) {
            // could not parse the saved data, perhaps someone messed with it
            context.knownNodes = {};
        }
    }
    console.log("Loaded options");
    console.log(context);
}
/**
 * Searches on ServiceNow doc or api sites
 * @param {object} evt the event that triggered the action
 */
function searchNow (evt) {
    let currentText = document.getElementById("searchInput").value;
    let targetUrl = (evt.target.id === "search_doc" ? "https://docs.servicenow.com/search?q=" + currentText : "https://developer.servicenow.com/app.do#!/search?category=API&q=" + currentText);
    chrome.tabs.create({ url: targetUrl });
}
/**
 * Generates the list of links to the tabs
 */
function refreshList () {
    for (var key in context.tabs) {
        let li1 = document.createElement("li");
        li1.setAttribute("data-instance", key);
        let instanceName = "";
        if (context.knownInstances !== undefined && context.knownInstances[key] !== undefined) {
            // we already know about this instance
            instanceName = context.knownInstances[key];
        } else {
            // else, save instance url into the knownInstances object
            instanceName = key;
            context.knownInstances[key] = key;
        }
        let instanceNameH3 = document.createElement("h3");
        instanceNameH3.innerHTML = instanceName;
        let instanceCommandsNode = document.createElement("a");
        instanceCommandsNode.setAttribute("href", "#");
        instanceCommandsNode.classList.add("instance-commands");
        instanceCommandsNode.setAttribute("data-instance", key);
        instanceCommandsNode.innerHTML = "&#128270;";
        instanceCommandsNode.onclick = scanNodes;
        instanceCommandsNode.title = "scan nodes";
        let instanceNodes = document.createElement("select");
        instanceNodes.className = "nodes-list";
        instanceNodes.setAttribute("data-instance", key);
        let option = document.createElement("option");
        option.text = "Scan instance to discover its nodes";
        instanceNodes.appendChild(option);

        instanceNameH3.appendChild(instanceNodes);
        instanceNameH3.appendChild(instanceCommandsNode);
        li1.appendChild(instanceNameH3);

        let ul = document.createElement("ul");
        ul.classList.add("linksToTabs");

        context.tabs[key].forEach(function (tab) {
            context.tabCount++;
            let li = document.createElement("li");
            if (!tab.active) {
                li.className = "linkToTab";
            } else { li.className = "selectedTab"; }
            li.onclick = switchTab;
            li.id = tab.id; // li id is the same as tab id for easy switching
            li.innerHTML = tab.title;
            ul.appendChild(li);
        });
        li1.appendChild(ul);
        document.querySelector("#opened_tabs").appendChild(li1);
    }
    if (context.tabCount === 0) {
        let li1 = document.createElement("li");
        li1.innerHTML += "<p class=\"text-muted\">No tab found :( Have you configured your URL filters in the options page?</p>";
        document.querySelector("#opened_tabs").appendChild(li1);
    }
    let selectInstance = document.getElementById("new_tab");
    for (var instanceKey in context.knownInstances) {
        let option = document.createElement("option");
        option.text = context.knownInstances[instanceKey];
        option.setAttribute("value", "https://" + instanceKey + "/nav_to.do?uri=blank.do");
        option.setAttribute("data-instance", instanceKey);
        selectInstance.appendChild(option);
    }
}

/**
 * Generates the list of links to the tabs
 * @param {Object} elt parent node
 */
function removeChildren (elt) {
    while (elt.firstChild) {
        elt.removeChild(elt.firstChild);
    }
}

/**
 * Generates the list of links to the tabs
 * @param {String} instance optional - the instance for which we want to refresh the nodes list
 * @param {String} selectNode optional - the current node for this instance
 */
function refreshNodes (instance, selectNode) {
    if (context.knownNodes === undefined) { return false; }
    var addNodes = function (key, elt, selectNode) {
        context.knownNodes[key].forEach(function (item) {
            let option = document.createElement("option");
            option.value = item;
            option.innerText = item;
            if (selectNode !== undefined && item === selectNode) {
                option.setAttribute("selected", "selected");
            }
            elt.appendChild(option);
        });
    };
    if (instance !== undefined) {
        let select = document.querySelector("select[data-instance=\"" + instance + "\"]");
        removeChildren(select);
        addNodes(instance, select, selectNode);
        select.style.display = "inline-block";
    } else {
        Object.keys(context.knownNodes).forEach(function (key) {
            let select = document.querySelector("select[data-instance=\"" + key + "\"]");
            if (select) {
                removeChildren(select);
                addNodes(key, select);
            }
        });
    }
}

/**
 * Initial function that gets the saved preferences and the list of open tabs
 */
function bootStrap () {
    let urlFiltersArr = context.urlFilters.split(";");

    var getTabs = function (tabs) {
        tabs.forEach(function (tab) {
            let splittedInstance = tab.url.toString().split("/");
            tab.instance = splittedInstance[2];
            if (tab.instance === "signon.service-now.com") {
                // known non-instance subdomains of service-now.com
                return false;
            }
            let matchFound = false;
            urlFiltersArr.forEach(function (filter) {
                if (matchFound || filter.trim() === "") return true;
                if (tab.url.toString().indexOf(filter.trim()) > -1) {
                    matchFound = true;
                }
            });
            if (matchFound) {
                let splittedName = tab.title.toString().split("|");
                if (splittedName.length === 3) {
                    // this is a specific object
                    tab.title = splittedName[1].toString().trim() + " - " + splittedName[0].toString().trim();
                } else if (splittedName.length === 2) {
                    // this is a list of objects
                    tab.title = splittedName[0].toString().trim();
                }

                // if this is the first tab we find for this instance, create the container is the context.tab object
                if (!context.tabs.hasOwnProperty(tab.instance)) { context.tabs[tab.instance] = []; }
                context.tabs[tab.instance].push(tab);
            }
        });
        refreshList();
        saveKnownInstances();
        // refreshNodes();
    };
    chrome.tabs.query({}, getTabs);
}

document.addEventListener("DOMContentLoaded", function () {
    getOptions();
    bootStrap();
    document.getElementById("config").addEventListener("click", function () {
        if (chrome.runtime.openOptionsPage) {
            chrome.runtime.openOptionsPage();
        } else {
            window.open(chrome.runtime.getURL("options.html"));
        }
    });
    document.getElementById("new_tab").addEventListener("change", newTab);
    document.getElementById("search_doc").addEventListener("click", searchNow);
    document.getElementById("search_api").addEventListener("click", searchNow);
    document.getElementById("searchInput").addEventListener("keyup", function (event) {
        event.preventDefault();
        if (event.keyCode === 13) {
            document.getElementById("search_doc").click();
        }
    });
    document.getElementById("searchInput").focus();
});
