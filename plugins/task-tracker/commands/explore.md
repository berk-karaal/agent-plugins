---
description: Explore a tracked task before any code — learn the project and the why, compare approaches with the user, write an exploration note and a summary
argument-hint: [task-id]
disable-model-invocation: true
allowed-tools: Bash, Read, Glob, Grep, Write, Edit, AskUserQuestion, Agent, WebFetch, WebSearch
---

# Explore a task

Understand the task, the project and the options before any implementation, together with the
user, so they get in sync and can steer. Follow the `task-tracking` skill conventions.

## Ground rules

- **Explore only.** Change nothing outside `.tasks/<id>/`: no code, config, installs or commits,
  until the user approves an approach after this command.
- **Read wherever it helps.** The project is the home base, not a fence: follow the task into
  other projects, knowledge-base hubs and documents whenever they add context, and list what
  you read outside the project in the note.
- **Don't jump to the first idea.** Find out what is there, then compare options.
- **Keep facts apart from ideas.** Facts carry `file:line` references; label guesses as guesses.
- **Scale the depth to the task.** A small, clear fix gets a short pass and a short note.
- **Keep the context lean.** Use subagents for broad searches, then read the key files they name
  yourself.

## Steps

1. **Resolve the task.** `$ARGUMENTS` if given; else the active task; else show
   `.tasks/INDEX.md` and ask. A dangling link (`[ -L ]` true, `[ -d ]` false) is a hard stop:
   report it and suggest `/task-tracker:unlink <id>`. Read `task.md`, `progress.md` and the
   existing notes; an earlier exploration is the starting point, not something to redo.

2. **Load personal instructions.** Find every `TASK_EXPLORE.md` from the project up to `/`:

   ```sh
   d="$PWD"; while :; do [ -f "$d/TASK_EXPLORE.md" ] && echo "$d/TASK_EXPLORE.md"; [ "$d" = / ] && break; d=$(dirname "$d"); done
   ```

   Read them all. They are appended to this command: follow both, and where they conflict the
   file wins, the deeper file over the higher one.

3. **Learn the project.**
   - Read every `AGENTS.md` and `CLAUDE.md` at the project root and in each folder on the way to
     the code the task touches, unless already in your context.
   - With no `AGENTS.md`, read `README`, `CONTRIBUTING` and `docs/`: list `docs/` first, then read
     its overview pages and every page related to the task. With an `AGENTS.md`, also read the
     docs it points to that relate to the task.
   - Map the structure: the top-level layout, the modules the task touches, and how the project
     is built, tested and run.

4. **Understand the task.**
   - What is asked, and the real problem behind it: the ticket and links in `task.md`, related
     issues and PRs, `git log` and `git blame` on the code involved, and any related projects or
     knowledge bases that `AGENTS.md`, `TASK_EXPLORE.md` or the task point to.
   - Who or what is affected, and what is out of scope.
   - How the code works today along the path the task touches, with `file:line`.

5. **Find the conventions.** The closest existing examples of similar work, in the code and in
   git history (`git log --oneline -S <term>`, `git log -- <path>`), and how the project names,
   structures, handles errors, tests and documents such things. Follow them by default. When one
   is a known bad practice (a security hole, a deprecated API, a known bug pattern), say so and
   propose the better way instead of copying it.

6. **Check in: playback.** Start the note now (step 9) and keep it current from here on. Tell
   the user what you understand the task to be and why, the key findings, your assumptions, and
   the questions the project could not answer, each with your recommended answer. Group related
   questions in a round; ask follow-ups in further rounds as the answers reshape the picture,
   researching again in between. Write each answer into the note straight away.

7. **Compare alternatives.** Work out the smallest change, the cleanest design, a pragmatic
   middle, and a smaller scope or not doing it; drop the ones that don't apply and add any that
   do. For each: how it works, how it fits the conventions, effort, risks, and what it rules
   out. Pick one and say why.

8. **Check in: decide.** Present the comparison, your recommendation and the open questions,
   then go back and forth as long as it helps: answers may raise new questions or call for more
   research. Continue until the user picks an approach or defers the choice.

9. **The note** is `.tasks/<id>/notes/<date '+%Y-%m-%d-%H-%M'>-exploration.md`:

   ```markdown
   # Exploration — <task-id>

   <date '+%Y-%m-%d %H:%M'> · commit <git rev-parse --short HEAD> on <branch>

   ## Summary
   ## Task and why
   ## How it works today
   ## Conventions and prior art
   ## Alternatives
   ## Decisions
   <!-- each with who decided: user or agent -->
   ## Out of scope
   ## Risks and open questions
   ## Next step
   ## Sources outside the project
   ```

   When done, update `task.md` (and its `## Changelog`) if the scope or acceptance criteria
   sharpened, add the milestone `- <timestamp> — Exploration done (→ notes/<file>).` to
   `progress.md` with a fresh **Next action**, and bump `INDEX.md`.

10. **Summarize** for the user: the task in two lines, the key findings, the chosen approach and
    why, risks, open questions, the next step, and the note's path. Then stop; implement only
    when the user says so.

Never `git add` or commit `.tasks/`.
