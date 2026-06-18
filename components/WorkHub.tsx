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
  HandCoins,
  Lightbulb,
  Link2,
  ListChecks,
  Plus,
  Route,
  ReceiptText,
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
  DealStatus,
  ExpenseCategory,
  ExpenseStatus,
  ResearchOpportunity,
  WorkProject,
  WorkProjectStatus,
  WorkProjectType,
} from "@/lib/types";

const projectTypes: WorkProjectType[] = ["Tour", "Release", "Campaign", "Collaboration"];
const projectStatuses: WorkProjectStatus[] = ["Idea", "Planning", "Active", "Complete"];
const dealStatuses: DealStatus[] = ["Lead", "Offered", "Negotiating", "Confirmed", "Paid", "Lost"];
const expenseStatuses: ExpenseStatus[] = ["Planned", "Committed", "Paid"];
const expenseCategories: ExpenseCategory[] = [
  "Travel",
  "Accommodation",
  "Production",
  "Musicians",
  "Marketing",
  "Other",
];

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
  deals: [],
  expenses: [],
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

function dealAmount(value: string): number {
  const parsed = Number(value.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDealAmount(amount: string, currency: string): string {
  if (!amount.trim()) return "No fee recorded";
  const cleaned = amount.replace(/[^0-9.-]/g, "");
  const numeric = Number(cleaned);
  if (!cleaned || !Number.isFinite(numeric)) return `${currency} ${amount}`;
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(numeric);
  } catch {
    return `${currency} ${numeric.toLocaleString()}`;
  }
}

function contactLabelForSort(contact: Contact): string {
  return contact.full_name || contact.company || "";
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
  const [showDealForm, setShowDealForm] = useState(false);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [dealDraft, setDealDraft] = useState({
    projectId: "",
    title: "",
    contactId: "",
    amount: "",
    currency: "EUR",
    status: "Offered" as DealStatus,
    eventDate: "",
    notes: "",
  });
  const [expenseDraft, setExpenseDraft] = useState({
    projectId: "",
    title: "",
    category: "Travel" as ExpenseCategory,
    amount: "",
    currency: "EUR",
    status: "Planned" as ExpenseStatus,
    dueDate: "",
    notes: "",
  });

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

  const openDealForm = (projectId = selectedProject?.id || activeProjects[0]?.id || "") => {
    setDealDraft((current) => ({ ...current, projectId }));
    setShowDealForm(true);
  };

  const addDeal = () => {
    if (!dealDraft.projectId || !dealDraft.title.trim()) return;
    const project = projects.find((item) => item.id === dealDraft.projectId);
    if (!project) return;
    updateProject(project.id, {
      deals: [
        ...project.deals,
        {
          id: `DEAL-${Date.now()}`,
          title: dealDraft.title.trim(),
          contactId: dealDraft.contactId,
          amount: dealDraft.amount.trim(),
          currency: dealDraft.currency,
          status: dealDraft.status,
          eventDate: dealDraft.eventDate,
          notes: dealDraft.notes.trim(),
          createdAt: new Date().toISOString(),
        },
      ],
    });
    setDealDraft({
      projectId: "",
      title: "",
      contactId: "",
      amount: "",
      currency: "EUR",
      status: "Offered",
      eventDate: "",
      notes: "",
    });
    setShowDealForm(false);
  };

  const updateDeal = (
    projectId: string,
    dealId: string,
    patch: Partial<WorkProject["deals"][number]>,
  ) => {
    const project = projects.find((item) => item.id === projectId);
    if (!project) return;
    updateProject(projectId, {
      deals: project.deals.map((deal) => (deal.id === dealId ? { ...deal, ...patch } : deal)),
    });
  };

  const removeDeal = (projectId: string, dealId: string) => {
    const project = projects.find((item) => item.id === projectId);
    if (!project) return;
    updateProject(projectId, {
      deals: project.deals.filter((deal) => deal.id !== dealId),
    });
  };

  const openExpenseForm = (projectId = selectedProject?.id || activeProjects[0]?.id || "") => {
    setExpenseDraft((current) => ({ ...current, projectId }));
    setShowExpenseForm(true);
  };

  const addExpense = () => {
    if (!expenseDraft.projectId || !expenseDraft.title.trim()) return;
    const project = projects.find((item) => item.id === expenseDraft.projectId);
    if (!project) return;
    updateProject(project.id, {
      expenses: [
        ...project.expenses,
        {
          id: `EXPENSE-${Date.now()}`,
          title: expenseDraft.title.trim(),
          category: expenseDraft.category,
          amount: expenseDraft.amount.trim(),
          currency: expenseDraft.currency,
          status: expenseDraft.status,
          dueDate: expenseDraft.dueDate,
          notes: expenseDraft.notes.trim(),
          createdAt: new Date().toISOString(),
        },
      ],
    });
    setExpenseDraft({
      projectId: "",
      title: "",
      category: "Travel",
      amount: "",
      currency: "EUR",
      status: "Planned",
      dueDate: "",
      notes: "",
    });
    setShowExpenseForm(false);
  };

  const updateExpense = (
    projectId: string,
    expenseId: string,
    patch: Partial<WorkProject["expenses"][number]>,
  ) => {
    const project = projects.find((item) => item.id === projectId);
    if (!project) return;
    updateProject(projectId, {
      expenses: project.expenses.map((expense) =>
        expense.id === expenseId ? { ...expense, ...patch } : expense,
      ),
    });
  };

  const removeExpense = (projectId: string, expenseId: string) => {
    const project = projects.find((item) => item.id === projectId);
    if (!project) return;
    updateProject(projectId, {
      expenses: project.expenses.filter((expense) => expense.id !== expenseId),
    });
  };

  const allDeals = projects.flatMap((project) =>
    project.deals.map((deal) => ({ ...deal, projectId: project.id, projectName: project.name })),
  );
  const confirmedDeals = allDeals.filter(
    (deal) => deal.status === "Confirmed" || deal.status === "Paid",
  );
  const openDeals = allDeals.filter(
    (deal) => deal.status === "Offered" || deal.status === "Negotiating",
  );
  const totalsByCurrency = confirmedDeals.reduce<Record<string, number>>((totals, deal) => {
    const amount = dealAmount(deal.amount);
    if (amount > 0) totals[deal.currency] = (totals[deal.currency] || 0) + amount;
    return totals;
  }, {});
  const allExpenses = projects.flatMap((project) =>
    project.expenses.map((expense) => ({
      ...expense,
      projectId: project.id,
      projectName: project.name,
    })),
  );
  const expenseTotalsByCurrency = allExpenses.reduce<Record<string, number>>(
    (totals, expense) => {
      const amount = dealAmount(expense.amount);
      if (amount > 0) totals[expense.currency] = (totals[expense.currency] || 0) + amount;
      return totals;
    },
    {},
  );
  const financialCurrencies = [
    ...new Set([...Object.keys(totalsByCurrency), ...Object.keys(expenseTotalsByCurrency)]),
  ].sort();

  const booked = contacts.filter((contact) =>
    /booked|confirmed|contract/i.test(contact.relationship_stage),
  ).length;
  const warm = contacts.filter(
    (contact) =>
      contact.relationship_temperature === "Hot" ||
      contact.relationship_temperature === "Warm",
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
              <span><b>{confirmedDeals.length || booked}</b><small>{confirmedDeals.length ? "Confirmed or paid bookings" : "Booked or confirmed relationships"}</small></span>
              <span><b>{openDeals.length}</b><small>Offers being discussed</small></span>
              <span><b>{warm}</b><small>Warm and hot relationships</small></span>
              <span><b>{projects.filter((project) => project.status === "Complete").length}</b><small>Completed projects</small></span>
            </div>
            {financialCurrencies.length > 0 && (
              <div className="finance-snapshot">
                <span>Booking value against planned costs</span>
                <div>
                  {financialCurrencies.map((currency) => {
                    const income = totalsByCurrency[currency] || 0;
                    const costs = expenseTotalsByCurrency[currency] || 0;
                    const balance = income - costs;
                    return (
                      <article key={currency}>
                        <small>{currency}</small>
                        <strong>{formatDealAmount(String(income), currency)}</strong>
                        <span>confirmed income</span>
                        <b className={balance < 0 ? "negative" : ""}>
                          {formatDealAmount(String(balance < 0 ? Math.abs(balance) : balance), currency)}
                        </b>
                        <span>{balance < 0 ? "to break even" : "forecast balance"}</span>
                      </article>
                    );
                  })}
                </div>
                <small>Planned costs count toward the forecast. Confirmation and payment statuses are entered manually.</small>
              </div>
            )}
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
          <article className="panel deal-ledger">
            <div className="work-section-heading">
              <div>
                <span className="eyebrow">Booking ledger</span>
                <h3>Track the commercial conversation.</h3>
                <p>Record offers, negotiations, confirmations, and payments without implying anything was received automatically.</p>
              </div>
              {projects.length > 0 && (
                <button className="button button-secondary" onClick={() => openDealForm()}>
                  <Plus size={13} /> Add booking
                </button>
              )}
            </div>
            {showDealForm && (
              <div className="deal-form">
                <label><span>Project</span><select value={dealDraft.projectId} onChange={(event) => setDealDraft({ ...dealDraft, projectId: event.target.value })}><option value="">Choose a project</option>{projects.filter((project) => project.status !== "Complete").map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}</select></label>
                <label><span>Booking or deal</span><input value={dealDraft.title} onChange={(event) => setDealDraft({ ...dealDraft, title: event.target.value })} placeholder="e.g. Berlin venue offer" /></label>
                <label><span>Contact</span><select value={dealDraft.contactId} onChange={(event) => setDealDraft({ ...dealDraft, contactId: event.target.value })}><option value="">No contact selected</option>{contacts.filter((contact) => contact.full_name || contact.company).sort((a, b) => contactLabelForSort(a).localeCompare(contactLabelForSort(b))).map((contact) => <option value={contact.id} key={contact.id}>{contact.full_name || contact.company}</option>)}</select></label>
                <label><span>Amount</span><input value={dealDraft.amount} onChange={(event) => setDealDraft({ ...dealDraft, amount: event.target.value })} placeholder="e.g. 1500" /></label>
                <label><span>Currency</span><select value={dealDraft.currency} onChange={(event) => setDealDraft({ ...dealDraft, currency: event.target.value })}><option>EUR</option><option>USD</option><option>GBP</option><option>AUD</option><option>CAD</option><option>CHF</option></select></label>
                <label><span>Status</span><select value={dealDraft.status} onChange={(event) => setDealDraft({ ...dealDraft, status: event.target.value as DealStatus })}>{dealStatuses.map((status) => <option key={status}>{status}</option>)}</select></label>
                <label><span>Show or decision date</span><input type="date" value={dealDraft.eventDate} onChange={(event) => setDealDraft({ ...dealDraft, eventDate: event.target.value })} /></label>
                <label className="wide"><span>Notes</span><input value={dealDraft.notes} onChange={(event) => setDealDraft({ ...dealDraft, notes: event.target.value })} placeholder="Terms, travel, deposit, next decision..." /></label>
                <div className="deal-form-actions">
                  <button className="text-button" onClick={() => setShowDealForm(false)}>Cancel</button>
                  <button className="button button-primary" onClick={addDeal} disabled={!dealDraft.projectId || !dealDraft.title.trim()}><HandCoins size={14} /> Record booking</button>
                </div>
              </div>
            )}
            <div className="deal-list">
              {allDeals
                .sort((a, b) => (b.eventDate || b.createdAt).localeCompare(a.eventDate || a.createdAt))
                .map((deal) => {
                  const contact = contacts.find((item) => item.id === deal.contactId);
                  return (
                    <div key={deal.id}>
                      <span className={`deal-status-dot ${deal.status.toLowerCase()}`} />
                      <div className="deal-main"><strong>{deal.title}</strong><small>{deal.projectName}{contact ? ` · ${contact.full_name || contact.company}` : ""}</small>{deal.notes && <p>{deal.notes}</p>}</div>
                      <div className="deal-date"><strong>{deal.eventDate ? dateLabel(deal.eventDate) : "Date not set"}</strong><small>{deal.status}</small></div>
                      <b className="deal-amount">{formatDealAmount(deal.amount, deal.currency)}</b>
                      <select value={deal.status} onChange={(event) => updateDeal(deal.projectId, deal.id, { status: event.target.value as DealStatus })} aria-label={`Status for ${deal.title}`}>{dealStatuses.map((status) => <option key={status}>{status}</option>)}</select>
                      <button className="project-delete" onClick={() => removeDeal(deal.projectId, deal.id)} title="Remove booking"><Trash2 size={12} /></button>
                    </div>
                  );
                })}
              {!allDeals.length && (
                <div className="deal-empty">
                  <span><HandCoins size={20} /></span>
                  <div><strong>No commercial activity recorded yet.</strong><small>{projects.length ? "Add an offer or booking when a real conversation starts." : "Create a project first, then record its offers and confirmed work here."}</small></div>
                  {projects.length > 0 && <button className="button button-secondary" onClick={() => openDealForm()}>Record first booking</button>}
                </div>
              )}
            </div>
          </article>
          <article className="panel finance-ledger">
            <div className="work-section-heading">
              <div>
                <span className="eyebrow">Budget and break-even</span>
                <h3>Know what the project needs to earn.</h3>
                <p>Track planned, committed, and paid costs. Forecasts stay separate by currency and use only the numbers you record.</p>
              </div>
              {projects.length > 0 && (
                <button className="button button-secondary" onClick={() => openExpenseForm()}>
                  <Plus size={13} /> Add cost
                </button>
              )}
            </div>
            {showExpenseForm && (
              <div className="deal-form expense-form">
                <label><span>Project</span><select value={expenseDraft.projectId} onChange={(event) => setExpenseDraft({ ...expenseDraft, projectId: event.target.value })}><option value="">Choose a project</option>{projects.filter((project) => project.status !== "Complete").map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}</select></label>
                <label><span>Cost</span><input value={expenseDraft.title} onChange={(event) => setExpenseDraft({ ...expenseDraft, title: event.target.value })} placeholder="e.g. Berlin to Paris train" /></label>
                <label><span>Category</span><select value={expenseDraft.category} onChange={(event) => setExpenseDraft({ ...expenseDraft, category: event.target.value as ExpenseCategory })}>{expenseCategories.map((category) => <option key={category}>{category}</option>)}</select></label>
                <label><span>Amount</span><input value={expenseDraft.amount} onChange={(event) => setExpenseDraft({ ...expenseDraft, amount: event.target.value })} placeholder="e.g. 240" /></label>
                <label><span>Currency</span><select value={expenseDraft.currency} onChange={(event) => setExpenseDraft({ ...expenseDraft, currency: event.target.value })}><option>EUR</option><option>USD</option><option>GBP</option><option>AUD</option><option>CAD</option><option>CHF</option></select></label>
                <label><span>Status</span><select value={expenseDraft.status} onChange={(event) => setExpenseDraft({ ...expenseDraft, status: event.target.value as ExpenseStatus })}>{expenseStatuses.map((status) => <option key={status}>{status}</option>)}</select></label>
                <label><span>Due or paid date</span><input type="date" value={expenseDraft.dueDate} onChange={(event) => setExpenseDraft({ ...expenseDraft, dueDate: event.target.value })} /></label>
                <label className="wide"><span>Notes</span><input value={expenseDraft.notes} onChange={(event) => setExpenseDraft({ ...expenseDraft, notes: event.target.value })} placeholder="Who pays, deposit terms, receipt reminder..." /></label>
                <div className="deal-form-actions">
                  <button className="text-button" onClick={() => setShowExpenseForm(false)}>Cancel</button>
                  <button className="button button-primary" onClick={addExpense} disabled={!expenseDraft.projectId || !expenseDraft.title.trim()}><ReceiptText size={14} /> Record cost</button>
                </div>
              </div>
            )}
            <div className="deal-list expense-list">
              {allExpenses
                .sort((a, b) => (b.dueDate || b.createdAt).localeCompare(a.dueDate || a.createdAt))
                .map((expense) => (
                  <div key={expense.id}>
                    <span className={`expense-status-dot ${expense.status.toLowerCase()}`} />
                    <div className="deal-main"><strong>{expense.title}</strong><small>{expense.projectName} · {expense.category}</small>{expense.notes && <p>{expense.notes}</p>}</div>
                    <div className="deal-date"><strong>{expense.dueDate ? dateLabel(expense.dueDate) : "Date not set"}</strong><small>{expense.status}</small></div>
                    <b className="deal-amount">{formatDealAmount(expense.amount, expense.currency)}</b>
                    <select value={expense.status} onChange={(event) => updateExpense(expense.projectId, expense.id, { status: event.target.value as ExpenseStatus })} aria-label={`Status for cost ${expense.title}`}>{expenseStatuses.map((status) => <option key={status}>{status}</option>)}</select>
                    <button className="project-delete" onClick={() => removeExpense(expense.projectId, expense.id)} title="Remove cost"><Trash2 size={12} /></button>
                  </div>
                ))}
              {!allExpenses.length && (
                <div className="deal-empty">
                  <span><ReceiptText size={20} /></span>
                  <div><strong>No project costs recorded yet.</strong><small>{projects.length ? "Add travel, accommodation, production, musician, or marketing costs to see a break-even forecast." : "Create a project first, then build a simple cost plan here."}</small></div>
                  {projects.length > 0 && <button className="button button-secondary" onClick={() => openExpenseForm()}>Add first cost</button>}
                </div>
              )}
            </div>
          </article>
        </div>
      )}
    </section>
  );
}
