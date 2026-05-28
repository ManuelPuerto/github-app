import type { CSSProperties } from "react";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

type SortMode = "recent" | "top";
type SortOrder = "asc" | "desc";
type SearchParams = Record<string, string | string[] | undefined>;

interface IssueRow {
  id: string;
  title: string;
  repository: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  excerpt: string;
  url: string;
}

function valueOfParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseSearchParams(params: SearchParams) {
  const sortParam = valueOfParam(params.sort);
  const orderParam = valueOfParam(params.order);
  const minParam = valueOfParam(params.minBounty);

  const sort: SortMode = sortParam === "top" ? "top" : "recent";
  const order: SortOrder = orderParam === "asc" ? "asc" : "desc";
  const minBounty = Math.max(0, Number(minParam ?? 0) || 0);

  return { sort, order, minBounty };
}

async function loadIssues() {
  try {
    const bounties = await prisma.bounty.findMany({
      include: { repository: true },
      orderBy: [{ updatedAt: "desc" }],
      take: 200,
    });

    return bounties.map<IssueRow>((bounty) => {
      const repository = `${bounty.repository.owner}/${bounty.repository.repo}`;
      const amount = Number(bounty.amount);

      return {
        id: bounty.id,
        title: `Issue #${bounty.issueNumber}`,
        repository,
        amount,
        currency: bounty.currency,
        status: bounty.status.replaceAll("_", " "),
        createdAt: bounty.createdAt,
        updatedAt: bounty.updatedAt,
        excerpt: `Bounty detected from label ${bounty.labelName}.`,
        url: `https://github.com/${repository}/issues/${bounty.issueNumber}`,
      };
    });
  } catch {
    return [];
  }
}

function sortIssues(issues: IssueRow[], sort: SortMode, order: SortOrder) {
  const direction = order === "asc" ? 1 : -1;

  return [...issues].sort((left, right) => {
    if (sort === "top") {
      return (left.amount - right.amount) * direction;
    }

    return (left.updatedAt.getTime() - right.updatedAt.getTime()) * direction;
  });
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatBounty(issue: IssueRow) {
  return `${issue.amount.toLocaleString("en", {
    maximumFractionDigits: 6,
  })} ${issue.currency}`;
}

export default async function Home({
  searchParams,
}: {
  searchParams?: SearchParams | Promise<SearchParams>;
}) {
  const resolvedParams = searchParams ? await searchParams : {};
  const { sort, order, minBounty } = parseSearchParams(resolvedParams);
  const issues = await loadIssues();
  const visibleIssues = sortIssues(
    issues.filter((issue) => issue.amount >= minBounty),
    sort,
    order,
  );

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <div>
          <p style={styles.eyebrow}>Pvium GitHub App</p>
          <h1 style={styles.title}>Issue Discovery</h1>
          <p style={styles.lede}>
            Browse connected repository issues by recency or payout amount, then
            open the source issue on GitHub.
          </p>
        </div>
        <a href="/deploy" style={styles.deployLink}>
          Deploy setup
        </a>
      </header>

      <section style={styles.panel}>
        <form style={styles.controls}>
          <label style={styles.control}>
            <span style={styles.label}>Sort by</span>
            <select name="sort" defaultValue={sort} style={styles.select}>
              <option value="recent">Recent</option>
              <option value="top">Top payout</option>
            </select>
          </label>
          <label style={styles.control}>
            <span style={styles.label}>Order</span>
            <select name="order" defaultValue={order} style={styles.select}>
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </select>
          </label>
          <label style={styles.control}>
            <span style={styles.label}>Minimum bounty</span>
            <input
              name="minBounty"
              defaultValue={minBounty || ""}
              inputMode="decimal"
              placeholder="0"
              style={styles.input}
            />
          </label>
          <button type="submit" style={styles.button}>
            Apply
          </button>
        </form>

        <div style={styles.summary}>
          Showing {visibleIssues.length} of {issues.length} connected bounty
          issues
        </div>

        {visibleIssues.length > 0 ? (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Issue</th>
                  <th style={styles.th}>Repository</th>
                  <th style={styles.th}>Bounty</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Updated</th>
                </tr>
              </thead>
              <tbody>
                {visibleIssues.map((issue) => (
                  <tr key={issue.id} style={styles.tr}>
                    <td style={styles.td}>
                      <a href={issue.url} style={styles.issueLink}>
                        {issue.title}
                      </a>
                      <p style={styles.excerpt}>{issue.excerpt}</p>
                    </td>
                    <td style={styles.td}>{issue.repository}</td>
                    <td style={styles.tdStrong}>{formatBounty(issue)}</td>
                    <td style={styles.td}>{issue.status}</td>
                    <td style={styles.td}>
                      <span>{formatDate(issue.updatedAt)}</span>
                      <span style={styles.created}>
                        Created {formatDate(issue.createdAt)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={styles.emptyState}>
            No connected bounty issues match the current filters.
          </div>
        )}
      </section>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    margin: 0,
    padding: "42px 20px",
    background: "#f6f7f9",
    color: "#172033",
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  header: {
    maxWidth: 1120,
    margin: "0 auto 18px",
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 20,
  },
  eyebrow: {
    margin: "0 0 10px",
    color: "#58667a",
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  title: {
    margin: "0 0 10px",
    fontSize: 40,
    lineHeight: 1.1,
    letterSpacing: 0,
  },
  lede: {
    maxWidth: 720,
    margin: 0,
    color: "#4a596d",
    fontSize: 16,
    lineHeight: 1.6,
  },
  deployLink: {
    flex: "0 0 auto",
    padding: "10px 14px",
    borderRadius: 8,
    background: "#172033",
    color: "#ffffff",
    fontSize: 14,
    fontWeight: 700,
    textDecoration: "none",
  },
  panel: {
    maxWidth: 1120,
    margin: "0 auto",
    padding: 20,
    border: "1px solid #d9dee8",
    borderRadius: 8,
    background: "#ffffff",
  },
  controls: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    alignItems: "end",
    gap: 12,
  },
  control: {
    display: "grid",
    gap: 6,
  },
  label: {
    color: "#526176",
    fontSize: 13,
    fontWeight: 700,
  },
  select: {
    minHeight: 40,
    border: "1px solid #cbd3df",
    borderRadius: 8,
    padding: "0 10px",
    background: "#ffffff",
    color: "#172033",
    fontSize: 14,
  },
  input: {
    minHeight: 38,
    border: "1px solid #cbd3df",
    borderRadius: 8,
    padding: "0 10px",
    color: "#172033",
    fontSize: 14,
  },
  button: {
    minHeight: 40,
    border: 0,
    borderRadius: 8,
    background: "#0f766e",
    color: "#ffffff",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
  },
  summary: {
    margin: "18px 0 10px",
    color: "#526176",
    fontSize: 14,
  },
  tableWrap: {
    overflowX: "auto",
    border: "1px solid #e0e5ee",
    borderRadius: 8,
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: 760,
  },
  th: {
    padding: "12px 14px",
    borderBottom: "1px solid #e0e5ee",
    background: "#f8fafc",
    color: "#526176",
    fontSize: 12,
    textAlign: "left",
    textTransform: "uppercase",
  },
  tr: {
    borderBottom: "1px solid #edf0f5",
  },
  td: {
    padding: "14px",
    color: "#344258",
    fontSize: 14,
    verticalAlign: "top",
  },
  tdStrong: {
    padding: "14px",
    color: "#172033",
    fontSize: 14,
    fontWeight: 800,
    verticalAlign: "top",
    whiteSpace: "nowrap",
  },
  issueLink: {
    color: "#155e75",
    fontWeight: 800,
    textDecoration: "none",
  },
  excerpt: {
    margin: "6px 0 0",
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.45,
  },
  created: {
    display: "block",
    marginTop: 5,
    color: "#718096",
    fontSize: 12,
  },
  emptyState: {
    marginTop: 16,
    padding: 24,
    border: "1px dashed #cbd3df",
    borderRadius: 8,
    color: "#526176",
    textAlign: "center",
  },
};
