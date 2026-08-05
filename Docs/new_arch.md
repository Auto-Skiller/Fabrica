
### 1.1 Agent Chat (Input and Output)

  - we need a credit availability check befor any agent launching or runing

  - for the (`selectedExtraSources`) file drops, and extra context items : we should add a "+" button just at the left of the send button, where a window will opens and user can drop files there or select missions or select workspace items so they be mentioned as extra context items. (enable multiselections).

  - it should be Triggered via (`Shift` + `Enter`) key or the **Send** button, `Enter` alone should add a new line in the chat.

  - we need live UI streaming

### 1.2 System Prompts & `AGENTS.md`

  - for `loadKernelSystemPrompts` **Realtime Harness Directives**: 
  keep the Output Language setting and the agentLang and webSearchEnabled and removes Autonomy Mode & Heartbeat Interval, Active Model selection, Active Backlogs & Review Queues, Suggestion Cards (keep them in `harness.json` but never Passed them to the CLI agent). 

  - for `AGENTS.md`, this is just user/project/businnes context (think of it like a memory file) not a system prompt directives, so remove it from the `loadKernelSystemPrompts`. instead we should appends critical prompt directives via `--append-system-prompt` and tag the `AGENTS.md` with `selectedExtraSources`: `[CRITICAL MEMORY CONTEXT DIRECTIVE: AGENTS.md is your long runing memory that survives, read it for more context and append to it when you found something interesting. keep it only for important things that you should remembers like user preferences, high-level project or businnes informations, high-level goals. and audit it instently if something changed or cancelled , we dont want outdated or canceled things.]`.

### 1.3 Output Language Dropdown

  - when user changes the langue from english , show an alert with something like (others langues consume more tokens, keep english for lower cost).

### 1.4 Web Search Toggle

  - this is Not for enabling or disabling web tools but it is to enforce the agent to do more real web internet search, so only when on -> Appends another critical prompt directives  via `--append-system-prompt` : `[CRITICAL WEB DIRECTIVE: Use live web tools for search and grounding when Needed.]`.

### 1.5 Context Progress Bar

  - total use in the shared auth.json allongside with the methodes and everything (user should not be able to audit those), it the one that need to be showed in the Account & API - Usage Quota & Token Alerts.

  - Context Progress Bar (Situated in the Agent Chat header) is not the total tokens used by user (the one in "Usage Quota & Token Alerts"), it is the current (cli agent model session) window context.
  for the Context Progress Bar : Every event emitted to stdout contains a usage payload reporting real-time token usage and max tokens ("contextWindow" and "maxTokens"), use that (changed in the ui based on current session).
  for the total tokens used by user (total accumulated user token usage): Pi automatically aggregates the usage from both AssistantMessage and ToolResultMessage to calculate total session token counts and costs, so use that for the total tokens used by user accumulations to show it in the "Usage Quota & Token Alerts".

  - we should have the Status Colors feature for both the Usage Quota & Token Alerts and the Context Progress Bar, also when hovering the Account & API button , a small window need to shows the Usage Quota & Token Alerts.

### 1.6 Model Switcher (Agent Section vs. Account & API Section)

  - make the commands and the agent output langue smaller and add a new thinking level dropdown at the left of the web toggle. (each model have it own thinking levels options)

  - Refactor the "Tokens & API Credentials" section, it not longer a place to switch models, it only for setting up and manaigng the methodes and the api keys. actual model selections will be in the Dynamic dropdown in chat header. they both get dynamicly changed based on the currently methode slected in the "Tokens & API Credentials" section (each methode have models options differently).
  
  - Free tier gets only the FREE method , Power Tier gets Credit method + PAUS method , Enterprise Tier gets Credit method + PAUS method + BUOK method.
  
  - if method is BUOK, shows an "only free" and an "auto rotate" toggles in the Dynamic dropdown in chat header.

  - FREE method: "Tokens & API Credentials" -> just the Payment-Methode verification + Usage Quota & Token Alerts . Dynamic dropdown -> fixed models - no "only free" and "auto rotate" toggles .
  
  - Credit method:

    - "Tokens & API Credentials" -> a place for user to see his Credit Balance and Credit Top-Up via Payment-Methode + Usage Quota & Token Alerts.

    - Dynamic dropdown -> no models for now, keep it empty - no "only free" and "auto rotate" toggles .

  - PAUS method: 

    - "Tokens & API Credentials" -> a place for user to see what he pays link his Payment-Methode + Usage Quota & Token Alerts.

    - Dynamic dropdown ->  Dynamic dropdown -> no models for now, keep it empty - no "only free" and "auto rotate" toggles .

  - BUOK method: 

    - "Tokens & API Credentials" -> a provider dropdown that lists all providers, when user select a provider he should have a another model dropdown for all models of that selected provider and an api key filled where he can see and manage his stored key of that selected provider. 
    bellow user should have a long list of all providers with a search bar and an api key filled bellow each provider where user can see and manage his stored key of each provider. 

    - Dynamic dropdown -> a lits of only the providers/models that have a configured saved provider api key where user can switches between them, show an "only free" toggle where user see only filtred free providers/models and an "auto rotate" toggle and a "rotation config" that opens another window to set the rotation order of those providers/models (only that have saved keys + only free if free toggle is on). (those are only BUOK features).

### 1.7 Sessions Subsystem (List, Add, Switcher, Delete)

  - remove the `tokensUsed` calculation.

  - user should never be able to creat new or switches session if the current session have a working procces and didnt get to the agent_end yet. (show a "wait turn end or stop the agent" in the ui if user try to switches or adding new session befor the current ession agent_end).
  
  - when Delete Session, dont just unlink the `.jsonl` log file, but also delete it from the user `/.pi/agent/sessions/<sessionId>.jsonl`

---

### 2.1 Skills Subsystem

  - entirely remove that user skills Global Toggle Activation Behavior, and replace it with a Per-Skill Level toggle (only for user skills, kernel is always activates)

### 2.2 Extensions Subsystem (Integrations)

  - entirely removes User Workspace Extensions - user should never be able to creat an extention (also removes the `workspaces/<tenant_id>/.pi/extensions/`)

  - keep only Kernel Extensions with Selective Toggling (aready in the UI) but rename `Fabrica_kernel/extensions/` to `Fabrica_kernel/integrations/`, this integrations folder now should have a folder for each integration, inside that integration folder we should have only 2 folders (skills/ and extentions/). 

  - integrations discovery and loading : now each intgeration have a skills/ and extentions/. only the toggled on from the UI integrations that should be discovered and loaded to the agent cli (load both it skills/ and extentions/ folders - (only toggled on integrations)). 

  - user integrations configs should be in the `workspaces/<tenant_id>/tenant.json/`, (not for toggling on/off but for actual user integration configs).

---
  
### 3.1 Suggestions Cards

  - remove that parsePiJsonOutput(), agent will audit them inside the `harness.json` and the ui should get them form it.

  - Clicking a suggestion should just populates the `chatInput`, it should not triggers `handleSendPrompt()` (mybe user want ot edit the suggestion befor clicking send). 


### 3.2 Backlogs Subsystem

  - add a backlog type for each backlog item (suggested and validated) 
  suggested for backlogs that been added by the agent himself
  validated for backlogs that been added by the User via the UI. when user edits or move a suggested backlog, it instantly becomes validated backlog.


### 3.3 Reviews Subsystem & QA State

  - remove the **QA Evaluation Matrix** from the Reviews Subsystem, this Reviews Subsystem is not related to the missions review phase, this is for another different thing. it is for files and things that agent just did and should notify user about them to see them and gives feedbacks.

  - add a review type for each review item (pending and reviwed) 
  pending for backlogs that been added by the agent himself and user didnt ignore or gives feedback yet (they still always in the UI and harness.json).
  when user ignore a review item via a button from the ui, this item gets removed from the harness.josn reviews srection. if user gives feedback, it change to reviwed.

---

### 4.1 Autonomy Dropdown

  - change names to off, director, worker and remove manual.
  
  - we want to add a new_user_actions to the harness.josn where it should have : backlog_actions, reviews_actions, missions_actions, workspace_actions.
  those are for everything user done from the UI across backlogs, reviews, missions and workspace from the last `agent_end` so the agent can check this new_user_actions to know what the user are doing and detect intents and directions changements, they gets reseted to empty in each `agent_end`. note : they should be cleaned up only if it is a normal `agent_end`, if user cancell the agent in mid-turn via the stop button nothing gets cleaned up.

  - Default behaviors that should be in all autonomy modes:
  `agent_end` : soon as the agent end his turns, clean up the new_user_actions sections for new actions, then the app we have will handell puting all actions in the correct place of this section.

  - when the user triggers the agent to start by sending a prompt:

    - we should appends critical prompt directives via `--append-system-prompt`, something to:

      - lets him know about all things user made from the last agent end via the UI (the new_user_actions)

      - lets him know about all the current "validated" Backlogs and tell him to act based on them so he sont get drifted from the final goals and directions, he should always priorities user prompt over this validated backlos but keep them in mind and notify user with a "Final Direction DRIFT Detected" when he takes to much time in a work that are not relate to any validated backlog.
      and tell him that he should stricly add anything that could be a new backlog to the "suggested" Backlog so user can see it and remove, move or edit it so it be removed or validated from the UI.

      - lets him know about all the current "reviwed" Reviews and procces them based on the user feedbacks when he completed the work as a pre-last step.
      and tell him that he should stricly add anything that need the user to know about in the "pending" Reviews so user can see it and ignore (user will ignore if the review is ok and dont need feedback) or gives a feedback from the UI.

      - tell him once he finishes all the work he have a last step to read the 3 suggestions from harness.json and see if he needs to audit them, he can audit 1 of them, 2 or all, or keep as many as he need (based on current goals, backlogs, user intents and directions changements - those are next step suggetsions), but they are always 3 and the first one is always the high priotity suggestion.

    - also we should tag those files via `selectedExtraSources` : missions.json, workspace.json, harness.json files so he read/write them when needed.

### 4.2 Heartbeat Timer

  - add the 20 seconds option to the dropdown

  - heartbeat is a system that relays on the mode (Director/Worker) and a timer (ex. 5 min, 1 h, 1 day), the heartbeat timer starts after each `agent_end` and only if autonomy is not off. once the heartbeat timer ends trigger the agent with his default behaviors as a normal user prompt that says someting like see what need to be done based on your initial context based on the internal system prompt + additional  `--append-system-prompt` directives per-mode :

    - off : no heartbeat at all.

    - Worker : `--append-system-prompt` directives to say something like : once you figure out everyhting report and ask user fo approval to continue.

    - Director : `--append-system-prompt` directives to say something like : once you figure out everyhting report and continue.

---