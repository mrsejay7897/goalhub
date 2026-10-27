// ==================================
// GoalHub Match Predictions
// Interactive prediction selection
// ==================================

const predictionGroups = document.querySelectorAll(".prediction-options");

const submitPredictionsButton = document.getElementById("submit-predictions");
const predictionMessage = document.getElementById("prediction-message");
const predictionCount = document.getElementById("prediction-count");

const savedPredictions = JSON.parse(
    localStorage.getItem("goalhubPredictions") || "{}"
);

// Restore previously saved selections
predictionGroups.forEach(function(group, index) {

    const matchId = group.dataset.matchId || `match-${index + 1}`;
    group.dataset.matchId = matchId;

    const buttons = group.querySelectorAll("button");

    buttons.forEach(function(button) {

        button.classList.remove("selected-prediction");
        button.setAttribute("aria-pressed", "false");

        if (savedPredictions[matchId] === button.textContent.trim()) {
            button.classList.add("selected-prediction");
            button.setAttribute("aria-pressed", "true");
        }

        button.addEventListener("click", function() {

            buttons.forEach(function(btn) {
                btn.classList.remove("selected-prediction");
                btn.setAttribute("aria-pressed", "false");
            });

            button.classList.add("selected-prediction");
            button.setAttribute("aria-pressed", "true");

            if (predictionMessage) {
                predictionMessage.textContent =
                    "Selection made. Submit your predictions when you're ready.";
            }

            updatePredictionCount();
        });

    });

});

function updatePredictionCount() {

    let selectedCount = 0;

    predictionGroups.forEach(function(group) {
        if (group.querySelector(".selected-prediction")) {
            selectedCount++;
        }
    });

    if (predictionCount) {
        predictionCount.textContent =
            `${selectedCount} of ${predictionGroups.length} matches selected`;
    }
}

if (submitPredictionsButton) {

    submitPredictionsButton.addEventListener("click", function() {

        const predictions = {};

        predictionGroups.forEach(function(group) {

            const selectedButton = group.querySelector(".selected-prediction");

            if (selectedButton) {
                predictions[group.dataset.matchId] =
                    selectedButton.textContent.trim();
            }

        });

        if (Object.keys(predictions).length === 0) {

            if (predictionMessage) {
                predictionMessage.textContent =
                    "Please select at least one prediction first.";
            }

            return;
        }

        localStorage.setItem(
            "goalhubPredictions",
            JSON.stringify(predictions)
        );

        if (predictionMessage) {
            predictionMessage.textContent =
                `Success! ${Object.keys(predictions).length} prediction(s) saved on this device.`;
        }

    });

}

updatePredictionCount();

// =======================================
// GoalHub Upcoming Matches - SportScore
// Multi-League Fixtures
// =======================================

const matchesList = document.getElementById("matches-list");
const upcomingLeagueSelect = document.getElementById("upcoming-league-select");
const upcomingMatchesTitle = document.getElementById("upcoming-matches-title");

const upcomingLeagueNames = {
"english-premier-league": "Premier League",
"spanish-la-liga": "La Liga",
"italian-serie-a": "Serie A",
"german-bundesliga": "Bundesliga",
"french-ligue-1": "Ligue 1",
"uefa-champions-league": "Champions League"
};

function formatMatchDate(dateString) {
return new Date(dateString).toLocaleDateString("en-KE", {
weekday: "long",
day: "numeric",
month: "long",
year: "numeric"
});
}

function formatMatchTime(timeString) {
return new Date(timeString).toLocaleTimeString("en-KE", {
hour: "2-digit",
minute: "2-digit",
hour12: false
});
}

async function loadUpcomingMatches(leagueKey) {
if (!matchesList) return;

const leagueName = upcomingLeagueNames[leagueKey];
if (!leagueName) return;

if (upcomingMatchesTitle) {
    upcomingMatchesTitle.textContent = `📅 Upcoming ${leagueName} Matches`;
}

matchesList.innerHTML = '<p class="matches-message">Loading fixtures...</p>';

try {
    const dates = [];

    for (let i = 0; i < 14; i++) {
        const date = new Date();
        date.setDate(date.getDate() + i);

        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");

        dates.push(`${year}-${month}-${day}`);
    }

const results = await Promise.all(
        dates.map(async function(date) {
            const url =
                `https://sportscore.com/api/v1/fixtures/?sport=football&date=${date}&competition=${encodeURIComponent(leagueKey)}&limit=200`;

            try {
                const response = await fetch(url);

                if (!response.ok) {
                    console.warn(
                        `Fixtures request failed for ${date}:`,
                        response.status
                    );
                    return {};
                }

                return await response.json();

            } catch (error) {
                console.warn(
                    `Could not load fixtures for ${date}:`,
                    error
                );
                return {};
            }
        })
    );

    let allMatches = [];

    results.forEach(function(data) {
        if (Array.isArray(data.matches)) {
            allMatches = allMatches.concat(data.matches);
        }
    });

    console.log(`${leagueName} fixtures received:`, allMatches);

    const uniqueMatches = Array.from(
        new Map(
            allMatches.map(function(match) {
                return [
                    match.id || `${match.time}-${match.home}-${match.away}`,
                    match
                ];
            })
        ).values()
    );

    const validMatches = uniqueMatches.filter(function(match) {
        if (!match.time || !match.home || !match.away) return false;

        const kickoff = new Date(match.time);
        const now = new Date();

        if (Number.isNaN(kickoff.getTime()) || kickoff < now) return false;

        const competition = (match.competition || "").trim().toLowerCase();

        // The endpoint is queried by the selected league.
        // Accept missing competition names, but reject a conflicting name.
        if (!competition) return true;

        const aliases = {
            "english-premier-league": ["premier league", "english premier league"],
            "spanish-la-liga": ["la liga", "laliga", "spanish la liga"],
            "italian-serie-a": ["serie a", "italian serie a"],
            "german-bundesliga": ["bundesliga", "german bundesliga"],
            "french-ligue-1": ["ligue 1", "ligue 1", "french ligue 1"],
            "uefa-champions-league": ["champions league", "uefa champions league"]
        };

        return (aliases[leagueKey] || []).some(function(alias) {
            return competition.includes(alias);
        });
    });

    validMatches.sort(function(a, b) {
        return new Date(a.time) - new Date(b.time);
    });

    if (validMatches.length === 0) {
        matchesList.innerHTML =
            `<p class="matches-message">No upcoming ${leagueName} fixtures were found for the next 14 days.</p>`;
        return;
    }

    const groupedMatches = {};

    validMatches.forEach(function(match) {
        const date = new Date(match.time).toLocaleDateString("en-CA");

        if (!groupedMatches[date]) {
            groupedMatches[date] = [];
        }

        groupedMatches[date].push(match);
    });

    matchesList.innerHTML = Object.keys(groupedMatches)
        .sort()
        .map(function(date) {
            const matches = groupedMatches[date];

            return `
                <div class="match-day">
                    <div class="match-day-heading">
                        <h3 class="match-day-title">
                            ${formatMatchDate(matches[0].time)}
                        </h3>
                        <span class="match-count">
                            ${matches.length}
                            ${matches.length === 1 ? "MATCH" : "MATCHES"}
                        </span>
                    </div>

                    <div class="match-day-games">
                        ${matches.map(function(match) {
                            return `
                                <article class="match-card">
                                    <div class="match-card-header">
                                        <span class="match-league">
                                            <span class="league-dot"></span>
                                            ${leagueName.toUpperCase()}
                                        </span>
                                        <span class="match-time">
                                            ${formatMatchTime(match.time)}
                                        </span>
                                    </div>

                                    <div class="match-card-teams">
                                        <div class="match-team">
                                            ${match.home_logo ? `
                                                <img
                                                    src="${match.home_logo}"
                                                    alt=""
                                                    class="team-logo"
                                                    loading="lazy"
                                                    onerror="this.style.display='none'">
                                            ` : ""}
                                            <span class="team-name" title="${match.home}">
                                                ${match.home}
                                            </span>
                                        </div>

                                        <span class="match-vs">VS</span>

                                        <div class="match-team match-team-away">
                                            ${match.away_logo ? `
                                                <img
                                                    src="${match.away_logo}"
                                                    alt=""
                                                    class="team-logo"
                                                    loading="lazy"
                                                    onerror="this.style.display='none'">
                                            ` : ""}
                                            <span class="team-name" title="${match.away}">
                                                ${match.away}
                                            </span>
                                        </div>
                                    </div>

                                    <div class="match-card-footer">
                                        <span>Kick-off · ${formatMatchTime(match.time)}</span>
                                    </div>
                                </article>
                            `;
                        }).join("")}
                    </div>
                </div>
            `;
        }).join("");

} catch (error) {
    console.error(`${leagueName} upcoming matches error:`, error);

    matchesList.innerHTML =
        `<p class="matches-message">Unable to load ${leagueName} fixtures. Please try again later.</p>`;
}

}

if (matchesList) {
if (upcomingLeagueSelect) {
upcomingLeagueSelect.addEventListener("change", function() {
loadUpcomingMatches(upcomingLeagueSelect.value);
});

    loadUpcomingMatches(upcomingLeagueSelect.value);
} else {
    loadUpcomingMatches("english-premier-league");
}

}

// ================================
// GoalHub Multi-League Table
// ================================

const leagueTable = document.getElementById("league-table");
const standingsLeagueSelect = document.getElementById("standings-league-select");
const leagueTableTitle = document.getElementById("league-table-title");

const standingsLeagues = {
"english-premier-league": {
name: "Premier League",
slug: "english-premier-league"
},
"spanish-la-liga": {
name: "La Liga",
slug: "spanish-la-liga"
},
"italian-serie-a": {
name: "Serie A",
slug: "italian-serie-a"
},
"german-bundesliga": {
name: "Bundesliga",
slug: "german-bundesliga"
},
"french-ligue-1": {
name: "Ligue 1",
slug: "french-ligue-1"
},
"uefa-champions-league": {
name: "Champions League",
slug: "uefa-champions-league"
}
};

function loadGoalHubStandings(leagueKey) {

const selectedLeague = standingsLeagues[leagueKey];

if (!selectedLeague) {
    return;
}

leagueTableTitle.textContent = "🏆 " + selectedLeague.name + " Table";

leagueTable.innerHTML = `
    <tr>
        <td colspan="10">Loading ${selectedLeague.name} table...</td>
    </tr>
`;

// Remove the old Show More button
const oldButton = document.getElementById("table-toggle");

if (oldButton) {
    oldButton.remove();
}

fetch(
    "https://sportscore.com/api/widget/standings/?sport=football&slug=" +
    encodeURIComponent(selectedLeague.slug)
)

.then(function(response) {

    if (!response.ok) {
        throw new Error("League table request failed");
    }

    return response.json();

})

.then(function(data) {

    console.log(selectedLeague.name + " table:", data);

    if (!data.tables || !data.tables[0] || !data.tables[0].rows) {

        leagueTable.innerHTML = `
            <tr>
                <td colspan="10">
                    No standings available for ${selectedLeague.name}.
                </td>
            </tr>
        `;

        return;
    }

    const teams = data.tables[0].rows;

    if (teams.length === 0) {

        leagueTable.innerHTML = `
            <tr>
                <td colspan="10">
                    No standings available for ${selectedLeague.name}.
                </td>
            </tr>
        `;

        return;
    }

    leagueTable.innerHTML = teams.map(function(team, index) {

        return `
            <tr class="${index >= 5 ? "table-team-hidden" : ""}">

                <td>${team.pos ?? index + 1}</td>

                <td class="goalhub-team">
                    ${
                        team.team_logo
                            ? `<img src="${team.team_logo}" alt="${team.team || "Team"}" class="table-team-logo">`
                            : ""
                    }
                    <span>${team.team || "Unknown team"}</span>
                </td>

                <td>${team.p ?? "-"}</td>
                <td>${team.w ?? "-"}</td>
                <td>${team.d ?? "-"}</td>
                <td>${team.l ?? "-"}</td>
                <td>${team.gf ?? "-"}</td>
                <td>${team.ga ?? "-"}</td>
                <td>${
                    typeof team.gd === "number" && team.gd > 0
                        ? "+" + team.gd
                        : (team.gd ?? "-")
                }</td>
                <td><strong>${team.pts ?? "-"}</strong></td>

            </tr>
        `;

    }).join("");

    // Create Show More button when there are more than five teams
    if (teams.length > 5) {

        const tableElement = leagueTable.closest("table");
        const tableContainer = tableElement.parentElement;

        const button = document.createElement("button");

        button.id = "table-toggle";
        button.className = "show-more-btn";
        button.type = "button";
        button.textContent = "Show More ↓";

        tableContainer.appendChild(button);

        // Hide teams after the first five
        leagueTable.querySelectorAll(".table-team-hidden").forEach(function(row) {
            row.style.display = "none";
        });

        button.addEventListener("click", function() {

            const hiddenRows = leagueTable.querySelectorAll(".table-team-hidden");
            const expanded = button.dataset.expanded === "true";

            hiddenRows.forEach(function(row) {
                row.style.display = expanded ? "none" : "table-row";
            });

            button.dataset.expanded = expanded ? "false" : "true";

            button.textContent = expanded
                ? "Show More ↓"
                : "Show Less ↑";

        });

    }

})

.catch(function(error) {

    console.error(selectedLeague.name + " table error:", error);

    leagueTable.innerHTML = `
        <tr>
            <td colspan="10">
                Unable to load ${selectedLeague.name} table. Please try again later.
            </td>
        </tr>
    `;

});

}

// Load the selected league whenever the dropdown changes
// ========================================
// GoalHub: League Table and Top Scorers
// ========================================

const topScorersContainer = document.getElementById("top-scorers");
const topScorersTitle = document.getElementById("top-scorers-title");
const showMoreScorersBtn = document.getElementById("show-more-scorers");

const topScorerLeagueNames = {
"english-premier-league": "Premier League",
"spanish-la-liga": "La Liga",
"italian-serie-a": "Serie A",
"german-bundesliga": "Bundesliga",
"french-ligue-1": "Ligue 1",
"uefa-champions-league": "Champions League"
};

async function loadGoalHubTopScorers(leagueKey) {
if (!topScorersContainer) {
console.warn("GoalHub: Top Scorers HTML container was not found.");
return;
}

const leagueName = topScorerLeagueNames[leagueKey];
if (!leagueName) return;

if (topScorersTitle) {
    topScorersTitle.textContent = `⚽ ${leagueName} Top Scorers`;
}

if (showMoreScorersBtn) {
    showMoreScorersBtn.hidden = true;
    showMoreScorersBtn.textContent = "Show More ▼";
    showMoreScorersBtn.onclick = null;
}

topScorersContainer.innerHTML =
    `<p>Loading ${leagueName} top scorers...</p>`;

try {
    const url =
        `https://sportscore.com/api/widget/topscorers/?sport=football&slug=${encodeURIComponent(leagueKey)}&limit=10&stat=goals`;

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error("Top scorers request failed.");
    }

    const data = await response.json();
    console.log(`${leagueName} top scorers:`, data);

    const players = data.rows || data.scorers || data.players || [];

    if (!Array.isArray(players) || players.length === 0) {
        topScorersContainer.innerHTML =
            `<p>No top scorer data available for ${leagueName}.</p>`;
        return;
    }

    topScorersContainer.innerHTML = players.slice(0, 10).map(function(player, index) {
        const playerName =
            player.player || player.name || player.player_name || "Unknown player";

        const teamName =
            player.team || player.team_name || "";

        const goals =
            player.goals ?? player.total ?? player.value ?? player.stat ?? 0;

        const photo =
            player.player_logo || player.player_image || player.photo || player.image || "";

        return `
            <article class="scorer-card scorer-hidden-player"
                style="${index >= 5 ? "display:none;" : ""}">

                ${photo ? `
                    <img class="scorer-image"
                         src="${photo}"
                         alt="${playerName}"
                         loading="lazy"
                         onerror="this.style.display='none'">
                ` : ""}

                <div class="scorer-info">
                    <strong>${playerName}</strong>
                    <span>${teamName}</span>
                </div>

                <div class="scorer-goals">
                    <strong>${goals}</strong>
                    <span>Goals</span>
                </div>

            </article>
        `;
    }).join("");

    if (showMoreScorersBtn && players.length > 5) {
        showMoreScorersBtn.hidden = false;

        let expanded = false;

        showMoreScorersBtn.onclick = function() {
            expanded = !expanded;

            topScorersContainer
                .querySelectorAll(".scorer-hidden-player")
                .forEach(function(card, index) {
                    if (index >= 5) {
                        card.style.display = expanded ? "" : "none";
                    }
                });

            showMoreScorersBtn.textContent =
                expanded ? "Show Less ▲" : "Show More ▼";
        };
    }

} catch (error) {
    console.error(`${leagueName} top scorers error:`, error);

    topScorersContainer.innerHTML =
        `<p>Unable to load ${leagueName} top scorers. Please try again later.</p>`;
}

}

// Keep the table and scorers in sync
if (standingsLeagueSelect) {

standingsLeagueSelect.addEventListener("change", function() {

    const selectedLeague = standingsLeagueSelect.value;

    loadGoalHubStandings(selectedLeague);
    loadGoalHubTopScorers(selectedLeague);

});

// Load both sections for the default league
loadGoalHubStandings(standingsLeagueSelect.value);
loadGoalHubTopScorers(standingsLeagueSelect.value);

} else {

loadGoalHubStandings("english-premier-league");
loadGoalHubTopScorers("english-premier-league");

}
// ========================================
// GOALHUB LIVE SCORES - SPORTScore
// ========================================

const liveMatches = document.getElementById("live-matches");

let ghPinnedLiveMatches = JSON.parse(
    localStorage.getItem("ghPinnedLiveMatches") || "[]"
);

// Additional information for pinned matches
let ghPinnedMatchDetails = JSON.parse(
    localStorage.getItem("ghPinnedMatchDetails") || "{}"
);

// Keep the latest details of live matches
let ghLiveMatchCache = {};

// Save pinned match details
function saveGoalHubPinnedMatchDetails() {
    localStorage.setItem(
        "ghPinnedMatchDetails",
        JSON.stringify(ghPinnedMatchDetails)
    );
}

// Load live matches
async function loadGoalHubLiveScores() {

  const selectedLeagueBeforeLoad =
    document.getElementById("live-league-filter")?.value || "all";

if (!liveMatches) {
    console.error("GoalHub: #live-matches container not found.");
    return;
}

liveMatches.innerHTML = "<p>Loading live scores from six competitions...</p>";

const competitions = [
    { name: "Premier League", slug: "english-premier-league" },
    { name: "La Liga", slug: "spanish-la-liga" },
    { name: "Serie A", slug: "italian-serie-a" },
    { name: "Ligue 1", slug: "french-ligue-1" },
    { name: "Bundesliga", slug: "bundesliga" },
    { name: "UEFA Champions League", slug: "uefa-champions-league" }
];

try {

    const results = await Promise.allSettled(
        competitions.map(async function(league) {

          const response = await fetch(
    "https://sportscore.com/api/v1/fixtures/?sport=football&competition=" +
    league.slug +
    "&date=" + new Date().toISOString().slice(0, 10)
);

            if (!response.ok) {
                throw new Error(
                    league.name + " request failed: " + response.status
                );
            }

            const data = await response.json();
const liveMatchesForLeague = (
    Array.isArray(data.matches) ? data.matches : []
).filter(function(match) {
    const status = String(match.status || "").toLowerCase();

    return status === "live" || status === "finished";
});

const detailedMatches = await Promise.all(
    liveMatchesForLeague.map(async function(match) {

        try {
            const matchSlug = String(match.url || "")
                .split("/")
                .filter(Boolean)[2];

            if (!matchSlug) {
                return {
                    ...match,
                    competition: match.competition || league.name
                };
            }

            const detailResponse = await fetch(
                "https://sportscore.com/api/v1/match/?sport=football&slug=" +
                encodeURIComponent(matchSlug)
            );

            if (!detailResponse.ok) {
                throw new Error("Match details request failed");
            }

            const detailData = await detailResponse.json();
            const details = detailData.match || {};

            return {
                ...match,
                ...details,
                competition: match.competition || league.name
            };

        } catch (error) {
            console.warn(
                "Could not load minute for:",
                match.home,
                "vs",
                match.away,
                error
            );

            return {
                ...match,
                competition: match.competition || league.name
            };
        }
    })
);

return detailedMatches;
        })
    );

    const live = [];

    results.forEach(function(result, index) {

        if (result.status === "fulfilled") {
            live.push(...result.value);
        } else {
            console.error(
                "GoalHub could not load " + competitions[index].name + ":",
                result.reason
            );
        }
    });

    // Remove duplicate matches if the API returns any.
    const uniqueLive = Array.from(
        new Map(
            live.map(function(match) {
                return [String(match.id || match.url), match];
            })
        ).values()
    );

// Update pinned matches and track when they finish.
const now = Date.now();

ghPinnedLiveMatches = ghPinnedLiveMatches.filter(function(matchID) {
    const liveMatch = uniqueLive.find(function(match) {
        return String(match.id || match.url || "") === matchID;
    });

    const savedDetails = ghPinnedMatchDetails[matchID];

    // Update details when the match is available.
    if (liveMatch) {
        const wasFinished = savedDetails?.finishedAt;

        ghPinnedMatchDetails[matchID] = {
            match: liveMatch,
            pinnedAt: savedDetails?.pinnedAt || now,
            finishedAt:
                String(liveMatch.status || "").toLowerCase() === "finished"
                    ? (wasFinished || now)
                    : null
        };
    }

    const details = ghPinnedMatchDetails[matchID];

    // Remove a finished match after 10 minutes.
    if (
        details?.finishedAt &&
        now - details.finishedAt >= 10 * 60 * 1000
    ) {
        delete ghPinnedMatchDetails[matchID];
        return false;
    }

    return true;
});

// Save pinned IDs and their latest details.
localStorage.setItem(
    "ghPinnedLiveMatches",
    JSON.stringify(ghPinnedLiveMatches)
);

saveGoalHubPinnedMatchDetails();

const pinnedMatches = ghPinnedLiveMatches
    .map(function(matchID) {
        return ghPinnedMatchDetails[matchID]?.match || null;
    })
    .filter(Boolean);

// Group matches by competition.
const groupedMatches = {};

uniqueLive.forEach(function(match) {
    const competition = match.competition || "Other Competitions";

    if (!groupedMatches[competition]) {
        groupedMatches[competition] = [];
    }

    groupedMatches[competition].push(match);
});

// Remember the selected competition.
const selectedLeague = selectedLeagueBeforeLoad;

const competitionNames = [
    "Premier League",
    "La Liga",
    "Serie A",
    "Ligue 1",
    "Bundesliga",
    "UEFA Champions League"
];

const availableCompetitions = competitionNames.filter(function(name) {
    return groupedMatches[name] && groupedMatches[name].length > 0;
});

function renderLiveMatch(match) {
    const matchID = String(match.id || match.url || "");
    const isPinned = ghPinnedLiveMatches.includes(matchID);

    // Keep the latest match details available
ghLiveMatchCache[matchID] = match;

    const home = match.home || "Home Team";
    const away = match.away || "Away Team";
    const homeScore = match.home_score ?? "-";
    const awayScore = match.away_score ?? "-";

   const matchStatus = String(match.status || "").toLowerCase();

const statusText = matchStatus === "finished"
    ? "FULL TIME"
    : match.live_minute
        ? `LIVE · ${match.live_minute}′`
        : (match.status_text || "LIVE");

    return `
        <article class="live-card ${isPinned ? "pinned-live" : ""}">
            <div class="live-card-top">
                <span class="league">${match.competition || "Football"}</span>
             <span class="live-badge">
    ${matchStatus === "finished" ? "⚽ FULL TIME" : "🔴 LIVE"}
</span>
            </div>

            <div class="live-match">
                <div class="live-team">
                    ${match.home_logo
                        ? `<img src="${match.home_logo}" alt="" class="team-logo"
                            onerror="this.style.display='none'">`
                        : ""}
                    <strong>${home}</strong>
                </div>

                <div class="live-score">
                    <span>${homeScore}</span>
                    <strong> - </strong>
                    <span>${awayScore}</span>
                </div>

                <div class="live-team">
                    ${match.away_logo
                        ? `<img src="${match.away_logo}" alt="" class="team-logo"
                            onerror="this.style.display='none'">`
                        : ""}
                    <strong>${away}</strong>
                </div>
            </div>

            <div class="live-card-bottom">
                <span class="live-status">${statusText}</span>

                <button
                    type="button"
                    class="pin-live-btn"
                    onclick="toggleGoalHubPinnedMatch('${matchID.replace(/'/g, "\\'")}')">
                    ${isPinned ? "📌 PINNED" : "📌 PIN LIVE"}
                </button>
            </div>
        </article>
    `;
}

let displayHTML = `
    <div class="live-league-selector">
        <label for="live-league-filter">Choose another league:</label>
        <select id="live-league-filter"
            onchange="loadGoalHubLiveScores()">
            <option value="all" ${selectedLeague === "all" ? "selected" : ""}>
                All competitions
            </option>
            ${competitionNames.map(function(name) {
                return `
                    <option value="${name}"
                        ${selectedLeague === name ? "selected" : ""}>
                        ${name}
                    </option>
                `;
            }).join("")}
        </select>
    </div>
`;

if (pinnedMatches.length > 0 && selectedLeague === "all") {
displayHTML += `
    <section class="live-competition-group">
        <h3 class="live-competition-heading">📌 Pinned Matches</h3>
        <div class="live-matches-grid">
            ${pinnedMatches.map(renderLiveMatch).join("")}
        </div>
    </section>
`;
}

competitionNames.forEach(function(name) {
    if (selectedLeague !== "all" && selectedLeague !== name) {
        return;
    }

    const matches = groupedMatches[name] || [];

    if (matches.length === 0) {
        return;
    }

    displayHTML += `
        <section class="live-competition-group">
            <h3 class="live-competition-heading">⚽ ${name}</h3>
            <div class="live-matches-grid">
                ${matches.map(renderLiveMatch).join("")}
            </div>
        </section>
    `;
});

if (selectedLeague !== "all" && !groupedMatches[selectedLeague]) {
    displayHTML += `
        <p class="no-live-matches">
            No live matches are available in ${selectedLeague} right now.
            Choose another league or select All competitions.
        </p>
    `;
}

liveMatches.innerHTML = displayHTML;

} catch (error) {

    console.error("GoalHub live scores error:", error);

    liveMatches.innerHTML = `
        <div class="live-card">
            <p>Unable to load live scores.</p>
            <button type="button" onclick="loadGoalHubLiveScores()">
                Try Again
            </button>
        </div>
    `;
}

}
// Pin or unpin a live match
function toggleGoalHubPinnedMatch(matchID) {
if (ghPinnedLiveMatches.includes(matchID)) {
ghPinnedLiveMatches = ghPinnedLiveMatches.filter(function(id) {
return id !== matchID;
});

    delete ghPinnedMatchDetails[matchID];
    saveGoalHubPinnedMatchDetails();

} else {
    ghPinnedLiveMatches.push(matchID);

    if (ghLiveMatchCache[matchID]) {
        ghPinnedMatchDetails[matchID] = {
            match: ghLiveMatchCache[matchID],
            pinnedAt: Date.now(),
            finishedAt: null
        };

        saveGoalHubPinnedMatchDetails();
    }
}

localStorage.setItem(
    "ghPinnedLiveMatches",
    JSON.stringify(ghPinnedLiveMatches)
);

saveGoalHubPinnedMatchDetails();

loadGoalHubLiveScores();

}

// Make the function accessible to the HTML button
window.toggleGoalHubPinnedMatch = toggleGoalHubPinnedMatch;

// Initial load
loadGoalHubLiveScores();

// Refresh live scores every 60 seconds
setInterval(loadGoalHubLiveScores, 60000);

// ==================================
// GoalHub Football News - BBC Sport
// ==================================

const newsList = document.getElementById("news-list");
async function loadFootballNews() {
if (!newsList) {
console.error("News container #news-list was not found.");
return;
}

newsList.innerHTML = "<p>Loading football news...</p>";

try {
   const response = await fetch("https://goalhub-server-kiy9.onrender.com/api/news");

    if (!response.ok) {
        throw new Error("News request failed: " + response.status);
    }

    const data = await response.json();

    if (
        data.status !== "ok" ||
        !Array.isArray(data.articles) ||
        data.articles.length === 0
    ) {
        throw new Error("No news articles returned.");
    }

    newsList.innerHTML = data.articles.slice(0, 6).map(function(article) {
        const title = article.title || "Football News";

        const description = (article.description || "")
            .replace(/<[^>]*>/g, "")
            .trim();

        const image = article.image || "";

        const articleURL =
            article.link || "https://www.bbc.co.uk/sport/football";

        return `
            <article class="news-card">
                <div class="news-image">
                    ${
                        image
                            ? `<img src="${image}" alt="Football news"
                                 onerror="this.style.display='none'">`
                            : "⚽"
                    }
                </div>

                <div class="news-content">
                    <span>BBC Sport</span>
                    <h3>${title}</h3>

                    <p>
                        ${description || "Read the latest football news and updates."}
                    </p>

                    <a href="${articleURL}"
                       target="_blank"
                       rel="noopener noreferrer">
                        Read More →
                    </a>
                </div>
            </article>
        `;
    }).join("");

} catch (error) {
    console.error("GoalHub football news error:", error);

    newsList.innerHTML = `
        <div class="news-error">
            <h3>⚽ News temporarily unavailable</h3>
            <p>We couldn't load the latest football news.</p>
            <button type="button" onclick="loadFootballNews()">
                Try Again
            </button>
        </div>
    `;
}

}
loadFootballNews();
// ========================================
// GOALHUB MATCH CENTRE - FIXTURE SELECTOR
// ========================================

const ghLeagueSelect = document.getElementById("league-select");
const ghMatchSelect = document.getElementById("match-select");
const ghDateInput = document.getElementById("match-date");
const ghLoadButton = document.getElementById("load-match-btn");
const ghMessage = document.getElementById("match-selector-message");

let ghAvailableMatches = [];

// Set the date input to today's date
if (ghDateInput) {
    const today = new Date();

    ghDateInput.value =
        `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

// Load matches for the selected league and date
async function ghLoadFixtures() {

    if (!ghLeagueSelect || !ghMatchSelect || !ghDateInput) {
        return;
    }

    const league = ghLeagueSelect.value;
    const date = ghDateInput.value;

    if (!date) {
        ghMessage.textContent = "Please select a date.";
        return;
    }

    ghMatchSelect.innerHTML =
        '<option value="">Loading matches...</option>';

    ghMatchSelect.disabled = true;
    ghLoadButton.disabled = true;

    ghMessage.textContent = "Searching for available fixtures...";

    try {

        const selectedDate = new Date(date + "T00:00:00");

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const matchStatus = selectedDate < today
            ? "finished"
            : "upcoming";

        const url =
            `https://sportscore.com/api/v1/fixtures/?sport=football&date=${encodeURIComponent(date)}&competition=${encodeURIComponent(league)}&limit=200`;

        console.log("GoalHub fixtures URL:", url);
        console.log("Requested match status:", matchStatus);

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error("Could not retrieve fixtures.");
        }

        const data = await response.json();
        console.log("GoalHub fixture data:", data);
console.log("First match details:", data.matches?.[0]);
console.log("Selected match URL:", data.matches?.[0]?.url);

        const leagueNames = {
    "english-premier-league": [
        "premier league",
        "english premier league"
    ],
    "spanish-la-liga": [
        "la liga",
        "laliga"
    ],
    "italian-serie-a": [
        "serie a"
    ],
    "german-bundesliga": [
        "bundesliga"
    ],
    "french-ligue-1": [
        "ligue 1"
    ],
    "uefa-champions-league": [
        "champions league",
        "uefa champions league"
    ]
};

const allowedNames = leagueNames[league] || [];

ghAvailableMatches = Array.isArray(data.matches)
    ? data.matches.filter(match => {
        const competition = (match.competition || "").toLowerCase();

        return (
            match.time &&
            match.home &&
            match.away &&
            allowedNames.some(name => competition.includes(name))
        );
    })
    : [];

        ghAvailableMatches.sort((a, b) =>
            new Date(a.time) - new Date(b.time)
        );

        ghMatchSelect.innerHTML =
            '<option value="">Choose a match</option>';

        ghAvailableMatches.forEach((match, index) => {

            const option = document.createElement("option");

            option.value = index;
            option.textContent = `${match.home} vs ${match.away}`;

            ghMatchSelect.appendChild(option);

        });

        ghMatchSelect.disabled = ghAvailableMatches.length === 0;
        ghLoadButton.disabled = ghAvailableMatches.length === 0;

        if (ghAvailableMatches.length === 0) {

            ghMessage.textContent =
                "No upcoming matches found for this league and date. Try another date or league.";

        } else {

            ghMessage.textContent =
                `${ghAvailableMatches.length} match(es) found. Choose one and click View Match.`;

            ghMatchSelect.selectedIndex = 0;

        }

    } catch (error) {

        console.error("GoalHub Match Centre error:", error);

        ghAvailableMatches = [];

        ghMatchSelect.innerHTML =
            '<option value="">Fixtures unavailable</option>';

        ghMatchSelect.disabled = true;
        ghLoadButton.disabled = true;

        ghMessage.textContent =
            "Unable to load fixtures. Please try again later.";

    }
}

// ========================================
// GOALHUB - PREMIER LEAGUE HOME STADIUMS
// ========================================

const ghHomeStadiums = {
    "Arsenal": "Emirates Stadium",
    "Aston Villa": "Villa Park",
    "Bournemouth": "Vitality Stadium",
    "Brentford": "Gtech Community Stadium",
    "Brighton": "Amex Stadium",
    "Brighton and Hove Albion": "Amex Stadium",
    "Burnley": "Turf Moor",
    "Chelsea": "Stamford Bridge",
    "Crystal Palace": "Selhurst Park",
    "Everton": "Hill Dickinson Stadium",
    "Fulham": "Craven Cottage",
    "Leeds United": "Elland Road",
    "Liverpool": "Anfield",
    "Manchester City": "Etihad Stadium",
    "Manchester United": "Old Trafford",
    "Newcastle United": "St James' Park",
    "Nottingham Forest": "The City Ground",
    "Sunderland": "Stadium of Light",
    "Tottenham Hotspur": "Tottenham Hotspur Stadium",
    "West Ham United": "London Stadium",
    "Wolverhampton Wanderers": "Molineux Stadium"
};
// ========================================
// GOALHUB - FAST RECENT TEAM FORM
// ========================================

// Cache recent form results to avoid repeated API requests
const ghRecentFormCache = new Map();

// Load recent form for a team
async function ghLoadRecentForm(teamName, elementId) {
    const element = document.getElementById(elementId);

    if (!element) {
        console.warn("Recent form element not found:", elementId);
        return;
    }

    // Use cached results immediately when available
    const cacheKey = teamName.toLowerCase();

    if (ghRecentFormCache.has(cacheKey)) {
        element.innerHTML = ghRecentFormCache.get(cacheKey);
        return;
    }

    element.textContent = "Loading recent form...";

    try {
        const teamSlugs = {
            "Bournemouth": "bournemouth-afc",
            "Brighton and Hove Albion": "brighton",
            "Manchester United": "manchester-united",
            "Manchester City": "manchester-city",
            "Newcastle United": "newcastle-united",
            "Nottingham Forest": "nottingham-forest",
            "Tottenham Hotspur": "tottenham-hotspur",
            "West Ham United": "west-ham-united",
            "Wolverhampton Wanderers": "wolverhampton-wanderers",
            "Leeds United": "leeds-united"
        };

        const slug = teamSlugs[teamName] ||
            teamName.toLowerCase().replace(/\s+/g, "-");

        const completedMatches = [];
        const today = new Date();

        // Prepare the last 60 dates
        const dates = [];

        for (let i = 0; i < 60; i++) {
            const date = new Date(today);
            date.setUTCDate(date.getUTCDate() - i);
            dates.push(date.toISOString().slice(0, 10));
        }

        // Fetch dates in batches of 10 instead of one at a time
        for (let i = 0; i < dates.length; i += 10) {
            const batch = dates.slice(i, i + 10);

            const results = await Promise.all(
                batch.map(async function (dateString) {
                    const url =
                        `https://sportscore.com/api/v1/fixtures/` +
                        `?sport=football&date=${dateString}` +
                        `&team=${encodeURIComponent(slug)}` +
                        `&status=finished&limit=200`;

                    try {
                        const response = await fetch(url);

                        if (!response.ok) {
                            return [];
                        }

                        const data = await response.json();

                        return Array.isArray(data.matches)
                            ? data.matches
                            : [];
                    } catch (error) {
                        console.warn(
                            "Could not load results for",
                            dateString
                        );
                        return [];
                    }
                })
            );

            results.forEach(matches => {
                completedMatches.push(...matches);
            });

            // Stop early once we have enough matches to work with.
            // We still sort them by date before displaying the latest five.
            const uniqueCount = new Set(
                completedMatches.map(match =>
                    match.time + "-" + match.home + "-" + match.away
                )
            ).size;

            if (uniqueCount >= 10) {
                break;
            }
        }

        // Remove duplicate matches and keep completed games only
        const uniqueMatches = Array.from(
            new Map(
                completedMatches.map(match => [
                    match.time + "-" + match.home + "-" + match.away,
                    match
                ])
            ).values()
        ).filter(match =>
            match.status === "finished" &&
            match.home_score !== null &&
            match.away_score !== null &&
            match.home_score !== undefined &&
            match.away_score !== undefined
        );

        // Newest matches first
        uniqueMatches.sort(
            (a, b) => new Date(b.time) - new Date(a.time)
        );

        const lastFive = uniqueMatches.slice(0, 5);

        if (lastFive.length === 0) {
            element.textContent = "Recent results unavailable";
            return;
        }

        // Calculate each team's result
        const form = lastFive.map(match => {
            const homeScore = Number(match.home_score);
            const awayScore = Number(match.away_score);

            const isHome =
                match.home.toLowerCase() === teamName.toLowerCase();

            const teamScore = isHome ? homeScore : awayScore;
            const opponentScore = isHome ? awayScore : homeScore;

            if (teamScore > opponentScore) return "W";
            if (teamScore < opponentScore) return "L";
            return "D";
        });

        const colours = {
            W: "#16a34a",
            D: "#d97706",
            L: "#dc2626"
        };

        const html = `
            <div class="gh-form-results">
                ${form.map(result => `
                    <span
                        title="${result === "W" ? "Win" : result === "D" ? "Draw" : "Loss"}"
                        style="
                            display:inline-flex;
                            align-items:center;
                            justify-content:center;
                            width:30px;
                            height:30px;
                            margin:3px;
                            border-radius:50%;
                            background:${colours[result]};
                            color:white;
                            font-weight:bold;
                        "
                    >${result}</span>
                `).join("")}
            </div>
            <small>Last ${lastFive.length} completed matches · Newest first</small>
        `;

        // Save the finished display for future selections
        ghRecentFormCache.set(cacheKey, html);

        element.innerHTML = html;

    } catch (error) {
        console.error("GoalHub recent form error:", error);
        element.textContent = "Could not load recent form";
    }
}
// Load head-to-head statistics and previous meetings
async function ghLoadHeadToHead(home, away) {
    const homeWinsElement = document.getElementById("home-h2h-wins");
    const drawsElement = document.getElementById("h2h-draws");
    const awayWinsElement = document.getElementById("away-h2h-wins");
    const resultsElement = document.getElementById("head-to-head-results");

    if (!homeWinsElement || !drawsElement || !awayWinsElement || !resultsElement) {
        console.error("GoalHub: H2H HTML elements are missing.");
        return;
    }

    // Convert team names into API slugs
    const teamSlugs = {
        "Arsenal": "arsenal",
        "Aston Villa": "aston-villa",
        "Bournemouth": "bournemouth",
        "Bournemouth AFC": "bournemouth",
        "Brentford": "brentford",
        "Brighton": "brighton",
        "Brighton and Hove Albion": "brighton",
        "Burnley": "burnley",
        "Chelsea": "chelsea",
        "Crystal Palace": "crystal-palace",
        "Everton": "everton",
        "Fulham": "fulham",
        "Leeds": "leeds-united",
        "Leeds United": "leeds-united",
        "Liverpool": "liverpool",
        "Manchester City": "manchester-city",
        "Manchester United": "manchester-united",
        "Newcastle": "newcastle-united",
        "Newcastle United": "newcastle-united",
        "Nottingham Forest": "nottingham-forest",
        "Sunderland": "sunderland",
        "Tottenham": "tottenham-hotspur",
        "Tottenham Hotspur": "tottenham-hotspur",
        "West Ham": "west-ham-united",
        "West Ham United": "west-ham-united",
        "Wolves": "wolverhampton-wanderers",
        "Wolverhampton Wanderers": "wolverhampton-wanderers"
    };

    const homeSlug = teamSlugs[home];
    const awaySlug = teamSlugs[away];

    if (!homeSlug || !awaySlug) {
        resultsElement.textContent =
            "Head-to-head data is not available for these teams yet.";
        return;
    }

    homeWinsElement.textContent = "…";
    drawsElement.textContent = "…";
    awayWinsElement.textContent = "…";
    resultsElement.textContent = "Loading previous meetings…";

    try {
        const url =
            "https://sportscore.com/api/v1/h2h/" +
            "?sport=football" +
            "&team1=" + encodeURIComponent(homeSlug) +
            "&team2=" + encodeURIComponent(awaySlug) +
            "&limit=10";

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error("H2H request failed: " + response.status);
        }

        const data = await response.json();

        if (!data.summary || !Array.isArray(data.matches)) {
            throw new Error("Unexpected H2H response format.");
        }

        // Display the overall head-to-head record
        homeWinsElement.textContent = data.summary.team1_wins ?? 0;
        drawsElement.textContent = data.summary.draws ?? 0;
        awayWinsElement.textContent = data.summary.team2_wins ?? 0;

        // Display the previous meetings
        const matches = data.matches.filter(function (match) {
            return (
                match.status === "finished" &&
                match.home_score !== null &&
                match.home_score !== undefined &&
                match.away_score !== null &&
                match.away_score !== undefined
            );
        });

        if (matches.length === 0) {
            resultsElement.textContent =
                "No previous completed meetings were found.";
            return;
        }

        resultsElement.innerHTML = matches.map(function (match) {
            const homeScore = Number(match.home_score);
            const awayScore = Number(match.away_score);

            const date = match.time
                ? new Date(match.time).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric"
                })
                : "Date unavailable";

            return `
                <div class="h2h-match">
                    <span class="h2h-date">${date}</span>
                    <div class="h2h-scoreline">
                        <span class="h2h-team">${match.home}</span>
                        <strong>${homeScore} - ${awayScore}</strong>
                        <span class="h2h-team">${match.away}</span>
                    </div>
                </div>
            `;
        }).join("");

    } catch (error) {
        console.error("GoalHub H2H error:", error);

        homeWinsElement.textContent = "—";
        drawsElement.textContent = "—";
        awayWinsElement.textContent = "—";

        resultsElement.textContent =
            "Unable to load head-to-head data. Please try again later.";
    }
}
// Display the selected match in the Match Centre
function ghDisplaySelectedMatch() {

    const selectedIndex = ghMatchSelect.value;

    if (selectedIndex === "" || selectedIndex === null) {
        ghMessage.textContent = "Please choose a match first.";
        return;
    }

    const match = ghAvailableMatches[Number(selectedIndex)];

    console.log("Selected GoalHub match data:", match);
    console.log("GoalHub match slug:", match.slug);

    if (!match) {
        ghMessage.textContent = "Please select a valid match.";
        return;
    }

    const home = match.home;
    const away = match.away;

    // Update the team names throughout the Match Centre
    const teamNameIds = {
        "home-team-name": home,
        "away-team-name": away,
        "home-standing-name": home,
        "away-standing-name": away,
        "home-form-name": home,
        "away-form-name": away,
        "home-lineup-name": home,
        "away-lineup-name": away,
        "home-h2h-name": home + " Wins",
        "away-h2h-name": away + " Wins"
    };

    Object.entries(teamNameIds).forEach(([id, name]) => {

        const element = document.getElementById(id);

        if (element) {
            element.textContent = name;
        }

    });

    // Update the team abbreviations
    const badges = document.querySelectorAll(
        "#lineups .match-team-badge"
    );

    if (badges[0]) {
        badges[0].textContent = home.substring(0, 3).toUpperCase();
    }

    if (badges[1]) {
        badges[1].textContent = away.substring(0, 3).toUpperCase();
    }

    // Update the match date and kickoff time
    const kickoff = document.getElementById("match-kickoff");

    if (kickoff) {

        kickoff.textContent = new Date(match.time).toLocaleString(
            "en-KE",
            {
                weekday: "short",
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit"
            }
        );

    }

    // Update the competition name
    const competition = document.querySelector(
        "#lineups .match-competition"
    );

    if (competition) {
        competition.textContent =
            ghLeagueSelect.options[ghLeagueSelect.selectedIndex].text;
    }

    // Display the selected home team's usual stadium
const stadium = document.getElementById("match-stadium");

if (stadium) {
    const stadiumName = ghHomeStadiums[home];

    if (stadiumName) {
        stadium.textContent =
            `${stadiumName} (usual home ground; fixture venue unconfirmed)`;
    } else {
        stadium.textContent = "Stadium information unavailable";
    }

    console.log("GoalHub stadium displayed:", stadium.textContent);
}

    // Clear old statistics so they aren't attributed to the wrong teams
    [
        "home-position",
        "home-points",
        "home-played",
        "home-goals",
        "away-position",
        "away-points",
        "away-played",
        "away-goals",
        "home-h2h-wins",
        "h2h-draws",
        "away-h2h-wins"
    ].forEach(id => {

        const element = document.getElementById(id);

        if (element) {
            element.textContent = "—";
        }

    });

    // Reset previous match information
    [
        "home-recent-results",
        "away-recent-results",
        "head-to-head-results",
        "home-lineup-players",
        "away-lineup-players"
    ].forEach(id => {

        const element = document.getElementById(id);

        if (element) {
            element.textContent =
                "Information for this fixture is not connected yet.";
        }

    });

    [
        "home-formation",
        "away-formation"
    ].forEach(id => {

        const element = document.getElementById(id);

        if (element) {
            element.textContent = "Formation: Awaiting official information";
        }

    });

    const status = document.getElementById("lineup-status");

    if (status) {
        status.textContent = "Awaiting official line-ups";
    }

    // Load the selected teams' recent form
ghLoadRecentForm(home, "home-recent-results");
ghLoadRecentForm(away, "away-recent-results");

// Load head-to-head statistics
ghLoadHeadToHead(home, away);

// Load the selected match lineups
ghLoadLineups(match);

ghMessage.textContent =
    `Selected match: ${home} vs ${away}.`;

}
// Load lineups from SportScore
async function ghLoadLineups(match) {

    const homePlayers = document.getElementById("home-lineup-players");
    const awayPlayers = document.getElementById("away-lineup-players");
    const homeFormation = document.getElementById("home-formation");
    const awayFormation = document.getElementById("away-formation");
    const lineupStatus = document.getElementById("lineup-status");

    if (!match || !match.url) {
        if (lineupStatus) {
            lineupStatus.textContent = "Match information unavailable.";
        }
        return;
    }

    if (lineupStatus) {
        lineupStatus.textContent = "Loading lineups...";
    }

    try {

        const matchSlug = match.url
            .split("/")
            .filter(Boolean)[2];

        if (!matchSlug) {
            throw new Error("Match slug unavailable.");
        }

        const response = await fetch(
            `https://sportscore.com/api/v1/match/?sport=football&slug=${encodeURIComponent(matchSlug)}`
        );

        if (!response.ok) {
            throw new Error("Could not load lineups.");
        }

        const data = await response.json();
        const lineups = data.match?.lineups;

        if (!lineups) {
            throw new Error("Lineups unavailable.");
        }

        function renderPlayers(players) {

            if (!Array.isArray(players) || players.length === 0) {
                return "<p>Player information unavailable.</p>";
            }

            return players.map(player => `
                <div class="lineup-player">
                    <span class="lineup-number">${player.number ?? "—"}</span>
                    <span class="lineup-player-name">${player.name ?? "Unknown player"}${player.captain ? " (C)" : ""}</span>
                    <span class="lineup-position">${player.position ?? ""}</span>
                </div>
            `).join("");

        }

        if (homePlayers) {
            homePlayers.innerHTML = `
                <h4>Starting XI</h4>
                ${renderPlayers(lineups.home_xi)}
                <h4>Substitutes</h4>
                ${renderPlayers(lineups.home_subs)}
            `;
        }

        if (awayPlayers) {
            awayPlayers.innerHTML = `
                <h4>Starting XI</h4>
                ${renderPlayers(lineups.away_xi)}
                <h4>Substitutes</h4>
                ${renderPlayers(lineups.away_subs)}
            `;
        }

        if (homeFormation) {
            homeFormation.textContent =
                "Formation: " + (lineups.home_formation || "Unavailable");
        }

        if (awayFormation) {
            awayFormation.textContent =
                "Formation: " + (lineups.away_formation || "Unavailable");
        }

        if (lineupStatus) {
            lineupStatus.textContent = lineups.confirmed
                ? "Confirmed lineups"
                : "Lineup confirmation unavailable";
        }

    } catch (error) {

        console.error("GoalHub lineup error:", error);

        if (lineupStatus) {
            lineupStatus.textContent = "Lineups could not be loaded.";
        }

        if (homePlayers) {
            homePlayers.textContent = "Lineup information unavailable.";
        }

        if (awayPlayers) {
            awayPlayers.textContent = "Lineup information unavailable.";
        }

    }

}

// Connect the controls
if (ghLeagueSelect) {
    ghLeagueSelect.addEventListener("change", ghLoadFixtures);
}

if (ghDateInput) {
    ghDateInput.addEventListener("change", ghLoadFixtures);
}

if (ghLoadButton) {
ghLoadButton.addEventListener("click", function() {
ghDisplaySelectedMatch();
ghLoadMatchStandings();
});
}

if (ghMatchSelect) {
ghMatchSelect.addEventListener("change", function() {
if (ghMatchSelect.value) {
ghDisplaySelectedMatch();
ghLoadMatchStandings();
}
});
}
// Load the initial fixtures
ghLoadFixtures();
// ========================================
// GOALHUB MATCH CENTRE - LEAGUE STANDINGS
// ========================================

async function ghLoadMatchStandings() {

    const league = document.getElementById("league-select");

    if (!league) return;

    const slug = league.value;

    const homeName = document.getElementById("home-team-name")
        ?.textContent.trim();

    const awayName = document.getElementById("away-team-name")
        ?.textContent.trim();

    const message = document.querySelector(
        "#lineups .match-centre-panel .data-note"
    );

    try {

        const response = await fetch(
            `https://sportscore.com/api/widget/standings/?sport=football&slug=${encodeURIComponent(slug)}`
        );

        if (!response.ok) {
            throw new Error("Standings could not be loaded.");
        }

        const data = await response.json();

        console.log("GoalHub standings response:", data);

        // Read the standings table
        const teams = (data.tables || [])
            .flatMap(table => table.rows || []);

        if (teams.length === 0) {
            throw new Error("No teams found in the standings.");
        }

        // Standardise team names for matching
        function normaliseName(name) {

            return String(name || "")
                .toLowerCase()
                .replace(/&/g, "and")
                .replace(/\bfc\b/g, "")
                .replace(/\s+/g, " ")
                .trim();

        }

        function findTeam(teamName) {

            const wanted = normaliseName(teamName);

            return teams.find(team => {

                const name = normaliseName(
                    team.team ||
                    team.name ||
                    team.title ||
                    team.team_name
                );

                return name === wanted;

            });

        }

        function getValue(team, keys) {

            for (const key of keys) {

                if (
                    team[key] !== undefined &&
                    team[key] !== null &&
                    team[key] !== ""
                ) {
                    return team[key];
                }

            }

            return "—";

        }

        function updateElement(id, value) {

            const element = document.getElementById(id);

            if (element) {
                element.textContent = value;
            }

        }

        function updateTeam(prefix, teamName) {

            const team = findTeam(teamName);

            if (!team) {

                console.warn(
                    "GoalHub could not match this team:",
                    teamName
                );

                updateElement(`${prefix}-position`, "—");
                updateElement(`${prefix}-points`, "—");
                updateElement(`${prefix}-played`, "—");
                updateElement(`${prefix}-goals`, "—");

                return false;

            }

            updateElement(
                `${prefix}-position`,
                getValue(team, ["pos", "position", "rank", "place"])
            );

            updateElement(
                `${prefix}-points`,
                getValue(team, ["pts", "points"])
            );

            updateElement(
                `${prefix}-played`,
                getValue(team, ["p", "played", "matches_played", "matches"])
            );

            updateElement(
                `${prefix}-goals`,
                getValue(team, ["gd", "goal_difference", "goalDifference"])
            );

            return true;

        }

        const homeFound = updateTeam("home", homeName);
        const awayFound = updateTeam("away", awayName);

        if (message) {

            if (homeFound && awayFound) {

                message.textContent =
                    "League standings supplied by SportScore.";

            } else {

                message.textContent =
                    "Standings loaded, but one or both team names could not be matched.";

            }

        }

    } catch (error) {

        console.error("GoalHub standings error:", error);

        if (message) {
            message.textContent =
                "League standings are currently unavailable.";
        }

    }

}