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
            console.log("GoalHub competition key:", leagueKey, "Date:", date);

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

let ghPinnedMatchDetails = JSON.parse(
    localStorage.getItem("ghPinnedMatchDetails") || "{}"
);

let ghLiveMatchCache = {};

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

    liveMatches.innerHTML =
        "<p>Loading live scores from six competitions...</p>";

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
                const today = new Date();

                const datesToCheck = [
                    today.toISOString().slice(0, 10),
                    new Date(today.getTime() - 24 * 60 * 60 * 1000)
                        .toISOString()
                        .slice(0, 10)
                ];

                // Fetch today's and yesterday's fixtures
                const fixtureResults = await Promise.all(
                    datesToCheck.map(async function(date) {
                        const response = await fetch(
                            "https://sportscore.com/api/v1/fixtures/?sport=football&competition=" +
                            league.slug +
                            "&date=" + date
                        );

                        if (!response.ok) {
                            throw new Error(
                                league.name + " request failed: " +
                                response.status
                            );
                        }

                        return response.json();
                    })
                );

                const data = {
                    matches: fixtureResults.flatMap(function(result) {
                        return Array.isArray(result.matches)
                            ? result.matches
                            : [];
                    })
                };

               // Keep live, upcoming and finished matches
const matchesForLeague = (
    Array.isArray(data.matches) ? data.matches : []
).filter(function(match) {
    const status = String(match.status || "").toLowerCase();

    return [
        "live",
        "finished",
        "scheduled",
        "upcoming",
        "not_started",
        "not started"
    ].includes(status);
});
                const detailedMatches = await Promise.all(
                    matchesForLeague.map(async function(match) {
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
                                throw new Error(
                                    "Match details request failed"
                                );
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
                                "Could not load details for:",
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

        // Remove duplicate matches
        const uniqueLive = Array.from(
            new Map(
                live.map(function(match) {
                    return [String(match.id || match.url || ""), match];
                })
            ).values()
        );

        console.log("GoalHub live scores finished fetching:", uniqueLive.length, "matches");

        // Update pinned matches and track when they finish
        const now = Date.now();

        ghPinnedLiveMatches = ghPinnedLiveMatches.filter(function(matchID) {
            const liveMatch = uniqueLive.find(function(match) {
                return String(match.id || match.url || "") === matchID;
            });

            const savedDetails = ghPinnedMatchDetails[matchID];

            if (liveMatch) {
                const wasFinished = savedDetails?.finishedAt;
                const isFinished =
                    String(liveMatch.status || "").toLowerCase() === "finished";

                ghPinnedMatchDetails[matchID] = {
                    match: liveMatch,
                    pinnedAt: savedDetails?.pinnedAt || now,
                    finishedAt: isFinished ? (wasFinished || now) : null
                };
            }

            const details = ghPinnedMatchDetails[matchID];

            // Remove a finished match after ten minutes
            if (
                details?.finishedAt &&
                now - details.finishedAt >= 10 * 60 * 1000
            ) {
                delete ghPinnedMatchDetails[matchID];
                return false;
            }

            return true;
        });

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

            console.log("Live matches ready to render:", uniqueLive);
console.log("Pinned matches:", pinnedMatches);
console.log("Live matches container:", liveMatches);

// Cache matches for the pinning feature
uniqueLive.forEach(function(match) {
    const matchID = String(match.id || match.url || "");

    if (matchID) {
        ghLiveMatchCache[matchID] = match;
    }
});

// Apply the selected competition filter
const selectedLeague = selectedLeagueBeforeLoad;

const matchesToDisplay = uniqueLive.filter(function(match) {
    if (selectedLeague === "all") {
        return true;
    }

    return String(match.competition || "")
        .toLowerCase()
        .includes(selectedLeague.toLowerCase());
});

if (matchesToDisplay.length === 0) {
    liveMatches.innerHTML = `
        <div class="live-card">
            <p>No matches are available right now.</p>
            <button type="button" onclick="loadGoalHubLiveScores()">
                Refresh Scores
            </button>
        </div>
    `;
} else {
    liveMatches.innerHTML = matchesToDisplay.map(function(match) {
        const home = match.home || match.home_team || "Home";
        const away = match.away || match.away_team || "Away";
        const homeScore = match.home_score ?? match.homeScore ?? "-";
        const awayScore = match.away_score ?? match.awayScore ?? "-";
        const status = match.status || "Match";
        const matchID = String(match.id || match.url || "");
        const isPinned = ghPinnedLiveMatches.includes(matchID);

        return `
            <div class="live-card">
                <p class="live-card-league">
                    ${match.competition || "Football"}
                </p>
                <div class="live-card-teams">
                    <span>${home}</span>
                    <strong>${homeScore} - ${awayScore}</strong>
                    <span>${away}</span>
                </div>
                <p class="live-card-status">${status}</p>
                <button type="button"
                    onclick="toggleGoalHubPinnedMatch('${matchID}')">
                    ${isPinned ? "Unpin Match" : "Pin Match"}
                </button>
            </div>
        `;
    }).join("");
}

    } catch (error) {
       console.error("GoalHub live scores error:", error);
alert("GoalHub error: " + error.message);

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

// Pin or unpin a match
function toggleGoalHubPinnedMatch(matchID) {
    if (ghPinnedLiveMatches.includes(matchID)) {
        ghPinnedLiveMatches = ghPinnedLiveMatches.filter(function(id) {
            return id !== matchID;
        });

        delete ghPinnedMatchDetails[matchID];
    } else {
        ghPinnedLiveMatches.push(matchID);

        if (ghLiveMatchCache[matchID]) {
            const match = ghLiveMatchCache[matchID];

            ghPinnedMatchDetails[matchID] = {
                match: match,
                pinnedAt: Date.now(),
                finishedAt:
                    String(match.status || "").toLowerCase() === "finished"
                        ? Date.now()
                        : null
            };
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
window.loadGoalHubLiveScores = loadGoalHubLiveScores;

// Initial load
loadGoalHubLiveScores();

// Refresh live scores every 60 seconds
setInterval(loadGoalHubLiveScores, 60000);