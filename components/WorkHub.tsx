"use client";

import {
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  CircleDollarSign,
  Circle,
  Clock3,
  FolderKanban,
  Lightbulb,
  Link2,
  ListChecks,
  Plus,
  Route,
  ScanSearch,
  Sparkles,
  Target,
  Trash2,
  UserRound,
  WandSparkles,
} from "lucide-react";
import { Dispatch, SetStateAction, useMemo, useState } from "react";
import {
  AppView,
  ArtistProfile,
  Contact,
  ResearchOpportunity,
  WorkProject,
  WorkProjectStatus,
  WorkProjectType,
} from "@/lib/types";

const projectTypes: WorkProjectType[] = ["Tour", "Release", "Campaign", "Collaboration"];
const projectStatuses: WorkProjectStatus[] = ["Idea", "Planning", "Active", "Complete"];

type HubTab = "overview" | "calendar" | "outcomes";

const emptyProject = (profile: ArtistProfile): Omit<WorkProject, "id" | "createdAt"> => ({
  name: profile.currentProject || profile.projectName || "",
  type: "Tour",
  status: "Planning",
  startDate: "",
  endDate: "",
  goal: profile.careerGoals || "",
  targetValue: profile.defaultFee || "",
  notes: "",
  contactIds: [],
  opportunityIds: [],
  tasks: [],
});

function dateLabel(value: string): string {
  if (!value) return "No date";
  const parsed = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(parsed);
}

function daysFromNow(value: string): number {
  if (!value) return Number.POSITIVE_INFINITY;
  return Math.ceil(
    (new Date(`${value.slice(0, 10)}T00:00:00`).getTime() -
      new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00`).getTime()) /
      86400000,
  );
}

export default function WorkHub({
  contacts,
  opportunities,
  profile,
  projects,
  onProjectsChange,
  onNavigate,
}: {
  contacts: Contact[];
  opportunities: ResearchOpportunity[];
  profile: ArtistProfile;
  projects: WorkProject[];
  onProjectsChange: Dispatch<SetStateAction<WorkProject[]>>;
  onNavigate: (view: AppView) => void;
}) {
  const [tab, setTab] = useState<HubTab>("overview");
  const [draft, setDraft] = useState(emptyProject(profile));
  const [showForm, setShowForm] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [newTask, setNewTask] = useState("");
  const [newTaskDate, setNewTaskDate] = useState("");

  const activeProjects = projects.filter((project) => project.status !== "Complete");
  const activeOpportunities = opportunities.filter(
    (opportunity) =>
      opportunity.status === "Saved" || opportunity.status === "In progress",
  );
  const dueFollowUps = contacts.filter(
    (contact) =>
      contact.next_follow_up_date &&
      contact.next_follow_up_date <= new Date().toISOString().slice(0, 10),
  );

  const timeline = useMemo(() => {
    const projectDates = projects.flatMap((project) => {
      const dates = [];
      if (project.startDate) {
        dates.push({
          id: `${project.id}-start`,
          date: project.startDate,
          title: `${project.name} starts`,
          detail: `${project.type} · ${project.status}`,
          kind: "project",
        });
      }
      if (project.endDate) {
        dates.push({
          id: `${project.id}-end`,
          date: project.endDate,
          title: `${project.name} target finish`,
          detail: project.goal || "Project milestone",
          kind: "project",
        });
      }
      return dates;
    });
    const taskDates = projects.flatMap((project) =>
      project.tasks
        .filter((task) => task.status !== "Done" && task.dueDate)
        .map((task) => ({
          id: `${project.id}-${task.id}`,
          date: task.dueDate,
          title: task.title,
          detail: `${project.name} · ${task.status}`,
          kind: "project",
        })),
    );
    const followUps = contacts
      .filter((contact) => contact.next_follow_up_date)
      .map((contact) => ({
        id: `contact-${contact.id}`,
        date: contact.next_follow_up_date,
        title: `Follow up with ${contact.full_name || contact.company || "contact"}`,
        detail: contact.recommended_next_action || contact.company || contact.category,
        kind: "follow-up",
      }));
    const deadlines = opportunities
      .filter((opportunity) => opportunity.deadline && opportunity.status !== "Dismissed")
      .map((opportunity) => ({
        id: `opportunity-${opportunity.id}`,
        date: opportunity.deadline,
        title: opportunity.title,
        detail: `${opportunity.organisation} · ${opportunity.type}`,
        kind: "opportunity",
      }));
    return [...projectDates, ...taskDates, ...followUps, ...deadlines]
      .filter((item) => daysFromNow(item.date) >= -14)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 12);
  }, [contacts, opportunities, projects]);

  const createProject = () => {
    if (!draft.name.trim()) return;
    const id = `PROJECT-${Date.now()}`;
    onProjectsChange((current) => [
      {
        ...draft,
        id,
        name: draft.name.trim(),
        createdAt: new Date().toISOString(),
      },
      ...current,
    ]);
    setSelectedProjectId(id);
    setDraft(emptyProject(profile));
    setShowForm(false);
  };

  const updateProject = (id: string, patch: Partial<WorkProject>) => {
    onProjectsChange((current) =>
      current.map((project) => (project.id === id ? { ...project, ...patch } : project)),
    );
  };

  const selectedProject =
    projects.find((project) => project.id === selectedProjectId) || null;
  const selectedContacts = selectedProject
    ? selectedProject.contactIds
        .map((id) => contacts.find((contact) => contact.id === id))
        .filter((contact): contact is Contact => Boolean(contact))
    : [];
  const selectedOpportunities = selectedProject
    ? selectedProject.opportunityIds
        .map((id) => opportunities.find((opportunity) => opportunity.id === id))
        .filter((opportunity): opportunity is ResearchOpportunity => Boolean(opportunity))
    : [];

  const addTask = () => {
    if (!selectedProject || !newTask.trim()) return;
    updateProject(selectedProject.id, {
      tasks: [
        ...selectedProject.tasks,
        {
          id: `TASK-${Date.now()}`,
          title: newTask.trim(),
          status: "To do",
          dueDate: newTaskDate,
          createdAt: new Date().toISOString(),
        },
      ],
    });
    setNewTask("");
    setNewTaskDate("");
  };

  const booked = contacts.filter((contact) =>
    /booked|confirmed|contract/i.test(contact.relationship_stage),
  ).length;
  const warm = contacts.filter(
    (contact) =>
      contact.relationship_temperature === "Hot" ||
      contact.relationship_temperature === "Warm",
  ).length;
  const inProgress = opportunities.filter(
    (opportunity) => opportunity.status === "In progress",
  ).length;

  const playbooks = [
    {
      title: "Plan a tour",
      copy: "Build a route, shortlist contacts, and prepare outreach.",
      icon: Route,
      view: "tour" as AppView,
      action: "Open Tour Builder",
    },
    {
      title: "Find opportunities",
      copy: "Search your network and current sources for worthwhile openings.",
      icon: ScanSearch,
      view: "research" as AppView,
      action: "Open Scout",
    },
    {
      title: "Create campaign material",
      copy: "Turn your artist context into editable pitches and story angles.",
      icon: WandSparkles,
      view: "studio" as AppView,
      action: "Open Studio",
    },
  ];

  return (
    <section className="work-hub">
      <div className="work-hero">
        <div>
          <span className="eyebrow">Your projects</span>
          <h2>Run the work, not the software.</h2>
          <p>Keep every tour, release, campaign, and collaboration in one calm workspace.</p>
        </div>
        <button className="button button-primary" onClick={() => setShowForm(true)}>
          <Plus size={15} /> New project
        </button>
      </div>

      <div className="hub-tabs" role="tablist" aria-label="Project workspace">
        <button className={tab === "overview" ? "active" : ""} onClick={() => setTab("overview")}>
          <FolderKanban size={15} /> Overview
        </button>
        <button className={tab === "calendar" ? "active" : ""} onClick={() => setTab("calendar")}>
          <CalendarDays size={15} /> Calendar
          {timeline.length > 0 && <b>{timeline.length}</b>}
        </button>
        <button className={tab === "outcomes" ? "active" : ""} onClick={() => setTab("outcomes")}>
          <Target size={15} /> Outcomes
        </button>
      </div>

      {showForm && (
        <article className="panel project-form-card">
          <div className="project-form-heading">
            <div><strong>Start a project</strong><small>A name and goal are enough. Add detail when it becomes useful.</small></div>
            <button className="text-button" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
          <div className="project-form-grid">
            <label><span>Project name</span><input autoFocus value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="e.g. Autumn Europe tour" /></label>
            <label><span>Type</span><select value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value as WorkProjectType })}>{projectTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
            <label><span>Status</span><select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as WorkProjectStatus })}>{projectStatuses.map((status) => <option key={status}>{status}</option>)}</select></label>
            <label><span>Start date</span><input type="date" value={draft.startDate} onChange={(event) => setDraft({ ...draft, startDate: event.target.value })} /></label>
            <label><span>Target date</span><input type="date" value={draft.endDate} onChange={(event) => setDraft({ ...draft, endDate: event.target.value })} /></label>
            <label><span>Target value or fee</span><input value={draft.targetValue} onChange={(event) => setDraft({ ...draft, targetValue: event.target.value })} placeholder="Optional" /></label>
            <label className="wide"><span>Goal</span><input value={draft.goal} onChange={(event) => setDraft({ ...draft, goal: event.target.value })} placeholder="What should this project achieve?" /></label>
          </div>
          <div className="project-form-actions">
            <span><Check size={13} /> Saved only in this browser</span>
            <button className="button button-primary" disabled={!draft.name.trim()} onClick={createProject}>Create project <ArrowRight size={14} /></button>
          </div>
        </article>
      )}

      {tab === "overview" && (
        <>
          <div className="work-stats">
            <article><span><FolderKanban size={17} /></span><div><strong>{activeProjects.length}</strong><small>Active projects</small></div></article>
            <article><span><ListChecks size={17} /></span><div><strong>{dueFollowUps.length}</strong><small>Follow-ups due</small></div></article>
            <article><span><ScanSearch size={17} /></span><div><strong>{activeOpportunities.length}</strong><small>Saved opportunities</small></div></article>
          </div>

          <div className="work-overview-grid">
            <article className="panel project-portfolio">
              <div className="work-section-heading">
                <div><span className="eyebrow">Portfolio</span><h3>Projects in motion</h3></div>
                {projects.length > 0 && <button className="text-button" onClick={() => setShowForm(true)}><Plus size={13} /> Add project</button>}
              </div>
              <div className="project-list">
                {projects.map((project) => (
                  <div className={`project-row${selectedProjectId === project.id ? " selected" : ""}`} key={project.id}>
                    <span className={`project-type ${project.type.toLowerCase()}`}>{project.type.slice(0, 1)}</span>
                    <div className="project-row-copy">
                      <strong>{project.name}</strong>
                      <small>{project.type}{project.startDate ? ` · ${dateLabel(project.startDate)}` : ""}{project.endDate ? ` to ${dateLabel(project.endDate)}` : ""}</small>
                      <p>{project.goal || "Add a clear outcome when you are ready."}</p>
                    </div>
                    <select value={project.status} onChange={(event) => updateProject(project.id, { status: event.target.value as WorkProjectStatus })} aria-label={`Status for ${project.name}`}>
                      {projectStatuses.map((status) => <option key={status}>{status}</option>)}
                    </select>
                    <button className="project-open" onClick={() => setSelectedProjectId((current) => current === project.id ? "" : project.id)}>
                      {selectedProjectId === project.id ? "Close" : "Open"} <ArrowRight size={12} />
                    </button>
                    <button className="project-delete" onClick={() => {
                      onProjectsChange((current) => current.filter((item) => item.id !== project.id));
                      if (selectedProjectId === project.id) setSelectedProjectId("");
                    }} title="Remove project"><Trash2 size={13} /></button>
                  </div>
                ))}
                {!projects.length && (
                  <div className="project-empty">
                    <span><FolderKanban size={20} /></span>
                    <div><strong>Start with the work you already have.</strong><small>Create a tour, release, campaign, or collaboration. You can keep it simple.</small></div>
                    <button className="button button-secondary" onClick={() => setShowForm(true)}>Create first project</button>
                  </div>
                )}
              </div>
              {selectedProject && (
                <div className="project-cockpit">
                  <div className="project-cockpit-heading">
                    <div>
                      <span className="eyebrow">Project desk</span>
                      <h4>{selectedProject.name}</h4>
                      <p>{selectedProject.goal || "Add tasks and link the people or opportunities that move this project forward."}</p>
                    </div>
                    <span className="project-progress">
                      <b>{selectedProject.tasks.filter((task) => task.status === "Done").length}/{selectedProject.tasks.length}</b>
                      tasks done
                    </span>
                  </div>
                  <div className="project-task-entry">
                    <input
                      value={newTask}
                      onChange={(event) => setNewTask(event.target.value)}
                      onKeyDown={(event) => event.key === "Enter" && addTask()}
                      placeholder="Add the next practical task..."
                      aria-label="New project task"
                    />
                    <input
                      type="date"
                      value={newTaskDate}
                      onChange={(event) => setNewTaskDate(event.target.value)}
                      aria-label="Task due date"
                    />
                    <button className="button button-secondary" onClick={addTask} disabled={!newTask.trim()}><Plus size={13} /> Add task</button>
                  </div>
                  <div className="project-task-list">
                    {selectedProject.tasks.map((task) => (
                      <div className={task.status === "Done" ? "done" : ""} key={task.id}>
                        <button
                          className="task-check"
                          onClick={() =>
                            updateProject(selectedProject.id, {
                              tasks: selectedProject.tasks.map((item) =>
                                item.id === task.id
                                  ? { ...item, status: item.status === "Done" ? "To do" : "Done" }
                                  : item,
                              ),
                            })
                          }
                          aria-label={task.status === "Done" ? `Reopen ${task.title}` : `Complete ${task.title}`}
                        >
                          {task.status === "Done" ? <CheckCircle2 size={17} /> : <Circle size={17} />}
                        </button>
                        <span><strong>{task.title}</strong><small>{task.dueDate ? <><Clock3 size={11} /> {dateLabel(task.dueDate)}</> : "No due date"}</small></span>
                        <select
                          value={task.status}
                          onChange={(event) =>
                            updateProject(selectedProject.id, {
                              tasks: selectedProject.tasks.map((item) =>
                                item.id === task.id ? { ...item, status: event.target.value as "To do" | "Doing" | "Done" } : item,
                              ),
                            })
                          }
                          aria-label={`Status for ${task.title}`}
                        >
                          <option>To do</option><option>Doing</option><option>Done</option>
                        </select>
                        <button
                          className="project-delete"
                          onClick={() =>
                            updateProject(selectedProject.id, {
                              tasks: selectedProject.tasks.filter((item) => item.id !== task.id),
                            })
                          }
                          title="Remove task"
                        ><Trash2 size={12} /></button>
                      </div>
                    ))}
                    {!selectedProject.tasks.length && (
                      <div className="task-empty"><CheckCircle2 size={16} /> Add one small next task. The project becomes easier to act on immediately.</div>
                    )}
                  </div>
                  <div className="project-links">
                    <div>
                      <span><UserRound size={14} /> Linked contacts <b>{selectedContacts.length}</b></span>
                      {selectedContacts.slice(0, 4).map((contact) => <small key={contact.id}>{contact.full_name || contact.company}</small>)}
                      {!selectedContacts.length && <small>Link contacts from their profile.</small>}
                    </div>
                    <div>
                      <span><Link2 size={14} /> Linked opportunities <b>{selectedOpportunities.length}</b></span>
                      {selectedOpportunities.slice(0, 4).map((opportunity) => <small key={opportunity.id}>{opportunity.title}</small>)}
                      {!selectedOpportunities.length && <small>Add opportunities from Scout.</small>}
                    </div>
                  </div>
                </div>
              )}
            </article>

            <article className="panel next-deadlines">
              <div className="work-section-heading">
                <div><span className="eyebrow">Coming up</span><h3>Next dates</h3></div>
                <button className="text-button" onClick={() => setTab("calendar")}>Full calendar <ArrowRight size={12} /></button>
              </div>
              <div className="mini-timeline">
                {timeline.slice(0, 5).map((item) => (
                  <div key={item.id}>
                    <span className={item.kind}>{dateLabel(item.date).replace(/, \d{4}/, "")}</span>
                    <div><strong>{item.title}</strong><small>{item.detail}</small></div>
                  </div>
                ))}
                {!timeline.length && <div className="timeline-empty"><CalendarDays size={17} /> Dates from projects, follow-ups, and opportunities will appear here.</div>}
              </div>
            </article>
          </div>

          <div className="playbook-grid">
            {playbooks.map(({ title, copy, icon: Icon, view, action }) => (
              <button key={title} onClick={() => onNavigate(view)}>
                <span><Icon size={19} /></span>
                <div><strong>{title}</strong><small>{copy}</small><b>{action} <ArrowRight size={12} /></b></div>
              </button>
            ))}
          </div>
        </>
      )}

      {tab === "calendar" && (
        <article className="panel work-calendar">
          <div className="work-section-heading">
            <div><span className="eyebrow">One view of the work</span><h3>Projects, deadlines, and follow-ups</h3><p>Dates are gathered automatically from the rest of the workspace.</p></div>
          </div>
          <div className="calendar-list">
            {timeline.map((item) => {
              const days = daysFromNow(item.date);
              return (
                <div key={item.id}>
                  <span className={`calendar-kind ${item.kind}`}>{item.kind === "project" ? <FolderKanban size={15} /> : item.kind === "follow-up" ? <ListChecks size={15} /> : <ScanSearch size={15} />}</span>
                  <time><strong>{dateLabel(item.date)}</strong><small>{days < 0 ? `${Math.abs(days)} days overdue` : days === 0 ? "Today" : `In ${days} days`}</small></time>
                  <div><strong>{item.title}</strong><small>{item.detail}</small></div>
                </div>
              );
            })}
            {!timeline.length && <div className="project-empty"><span><CalendarDays size={20} /></span><div><strong>Your calendar is clear.</strong><small>Add project dates or follow-up dates and they will appear here.</small></div></div>}
          </div>
        </article>
      )}

      {tab === "outcomes" && (
        <div className="outcomes-layout">
          <article className="panel outcome-summary">
            <div className="work-section-heading"><div><span className="eyebrow">Progress snapshot</span><h3>What the work is producing</h3><p>Only recorded workspace activity is counted. No results are assumed.</p></div></div>
            <div className="outcome-metrics">
              <span><b>{booked}</b><small>Booked or confirmed relationships</small></span>
              <span><b>{inProgress}</b><small>Opportunities in progress</small></span>
              <span><b>{warm}</b><small>Warm and hot relationships</small></span>
              <span><b>{projects.filter((project) => project.status === "Complete").length}</b><small>Completed projects</small></span>
            </div>
          </article>
          <article className="panel outcome-guidance">
            <span><Lightbulb size={18} /></span>
            <div><span className="eyebrow">Manager’s note</span><h3>Keep outcomes factual.</h3><p>Update a relationship when a conversation moves forward, mark opportunities in progress, and complete projects when the real work is done. This keeps the dashboard useful and trustworthy.</p></div>
          </article>
          <article className="panel outcome-targets">
            <div className="work-section-heading"><div><span className="eyebrow">Project targets</span><h3>What success means</h3></div></div>
            {projects.map((project) => (
              <div key={project.id}>
                <span><Sparkles size={14} /></span>
                <div><strong>{project.name}</strong><small>{project.goal || "No goal recorded yet."}</small></div>
                <b>{project.targetValue || project.status}</b>
              </div>
            ))}
            {!projects.length && <div className="timeline-empty"><CircleDollarSign size={17} /> Add a project goal or target to make progress visible.</div>}
          </article>
        </div>
      )}
    </section>
  );
}
