/**
 * Feature guides for the official blog, seeded by seed_official_blog.ts.
 * Same markdown dialect as posts() there (see the converter's header comment).
 * Code, Mermaid and JSON chunks must not contain blank lines: blank lines split chunks.
 */

type Post = { slug: string; title: string; summary: string; tags: string[]; body: string }

const chart = (content: Record<string, unknown>) => "~~~block chart\n" + JSON.stringify(content) + "\n~~~"

const node = (id: string, x: number, y: number, title: string, subtitle = "", primary = false) => ({
  id,
  type: "sitemap",
  position: { x, y },
  data: { title, subtitle, nodeStyle: primary ? "primary" : "secondary" },
})
const edge = (source: string, target: string) => ({ id: `${source}-${target}`, source, target })

export function guidePosts(): Post[] {
  return [
    {
      slug: "code-examples",
      title: "Runnable examples in every language",
      summary: "One small, runnable program for each language a code block can run, plus a web page and syntax-only languages.",
      tags: ["guide", "code", "reference"],
      body: `
This page is a phrasebook: one short program per language, each a real code block with a **Run** button. Open one, change it and press Run again. The code runs in your browser, so nothing you type leaves your device. For how code blocks work (file tabs, limits, web previews), read [Code blocks](/u/nib/code-blocks).

!note The first run of a language downloads its runtime, from about 1 MB for JavaScript to about 30 MB for Java. After that it's cached, and the next run is instant.

## Python

A tab named \`stats.py\` is imported as \`stats\`.

\`\`\`python main.py
from stats import mean, median
scores = [72, 88, 95, 61, 84]
print("mean:", mean(scores))
print("median:", median(scores))
\`\`\`
\`\`\`python stats.py
def mean(xs):
    return sum(xs) / len(xs)
def median(xs):
    s = sorted(xs)
    mid = len(s) // 2
    return s[mid] if len(s) % 2 else (s[mid - 1] + s[mid]) / 2
\`\`\`

## JavaScript

Tabs are ES modules: \`export\` in one, \`import\` in another.

\`\`\`javascript main.js
import { slugify } from "./slug.js"
const titles = ["Hello, World!", "  Notes on   Writing ", "Ça va?"]
for (const t of titles) console.log(slugify(t))
\`\`\`
\`\`\`javascript slug.js
export function slugify(s) {
  return s.normalize("NFKD").replace(/[\\u0300-\\u036f]/g, "")
    .toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}
\`\`\`

## TypeScript

Types are stripped before the code runs; they document the shape of the data.

\`\`\`typescript main.ts
type Task = { title: string; done: boolean; minutes: number }
const tasks: Task[] = [
  { title: "Outline", done: true, minutes: 20 },
  { title: "Draft", done: false, minutes: 90 },
  { title: "Edit", done: false, minutes: 45 },
]
const left = tasks.filter((t) => !t.done)
const total = left.reduce((n, t) => n + t.minutes, 0)
console.log(left.length + " tasks left, " + total + " minutes")
\`\`\`

## Go

Every tab is part of \`package main\`, so \`main.go\` can call \`reverse\` from \`text.go\`.

\`\`\`go main.go
package main
import "fmt"
func main() {
	for _, w := range []string{"stressed", "drawer", "level"} {
		fmt.Printf("%s -> %s\\n", w, reverse(w))
	}
}
\`\`\`
\`\`\`go text.go
package main
func reverse(s string) string {
	r := []rune(s)
	for i, j := 0, len(r)-1; i < j; i, j = i+1, j-1 {
		r[i], r[j] = r[j], r[i]
	}
	return string(r)
}
\`\`\`

## C

Include another tab with \`#include "name.h"\`.

\`\`\`c main.c
#include <stdio.h>
#include "temp.h"
int main(void) {
    for (int c = 0; c <= 100; c += 25)
        printf("%3d C = %5.1f F\\n", c, to_fahrenheit(c));
    return 0;
}
\`\`\`
\`\`\`c temp.h
double to_fahrenheit(double c);
\`\`\`
\`\`\`c temp.c
#include "temp.h"
double to_fahrenheit(double c) { return c * 9.0 / 5.0 + 32.0; }
\`\`\`

## C++

\`\`\`cpp main.cpp
#include <iostream>
#include <map>
#include <sstream>
int main() {
    std::string text = "the quick fox jumps over the lazy dog the end";
    std::map<std::string, int> counts;
    std::istringstream in(text);
    for (std::string w; in >> w;) counts[w]++;
    for (auto& [word, n] : counts) if (n > 1) std::cout << word << ": " << n << "\\n";
}
\`\`\`

## Java

One public class per tab, named after the class. The class with \`main\` runs.

\`\`\`java Main.java
public class Main {
    public static void main(String[] args) {
        Account a = new Account("Ada", 100);
        a.deposit(50);
        a.withdraw(30);
        System.out.println(a);
    }
}
\`\`\`
\`\`\`java Account.java
public class Account {
    private final String owner;
    private int balance;
    public Account(String owner, int balance) { this.owner = owner; this.balance = balance; }
    public void deposit(int n) { balance += n; }
    public void withdraw(int n) { if (n <= balance) balance -= n; }
    public String toString() { return owner + " has " + balance; }
}
\`\`\`

## Ruby

Load another tab with \`require_relative\`.

\`\`\`ruby main.rb
require_relative "shelf"
shelf = Shelf.new
shelf.add("Dune", 1965)
shelf.add("Neuromancer", 1984)
shelf.add("Foundation", 1951)
shelf.oldest_first.each { |b| puts "#{b[:year]}  #{b[:title]}" }
\`\`\`
\`\`\`ruby shelf.rb
class Shelf
  def initialize = @books = []
  def add(title, year) = @books << { title:, year: }
  def oldest_first = @books.sort_by { |b| b[:year] }
end
\`\`\`

## SQLite

A SQL block starts from an empty database each run. Create tables, fill them and query in one go; every \`SELECT\` prints a table.

\`\`\`sql query.sql
CREATE TABLE posts (title TEXT, mode TEXT, reads INT);
INSERT INTO posts VALUES ('Welcome','skim',120),('Welcome','expert',40),('Charts','teach',75),('Charts','skim',30);
SELECT title, SUM(reads) AS total, MAX(reads) AS best_mode_reads
FROM posts GROUP BY title ORDER BY total DESC;
\`\`\`

## PostgreSQL

Choose **postgres** for PostgreSQL itself, with its functions, window queries and \`RAISE NOTICE\`.

\`\`\`postgres query.sql
CREATE TABLE sales (region TEXT, month INT, amount INT);
INSERT INTO sales VALUES ('North',1,10),('North',2,14),('South',1,8),('South',2,15);
SELECT region, month, amount,
       SUM(amount) OVER (PARTITION BY region ORDER BY month) AS running_total
FROM sales ORDER BY region, month;
\`\`\`

## A web page

Name tabs \`index.html\`, \`style.css\` and \`script.js\` and the reader gets a live **Preview** instead of a Run button.

\`\`\`html index.html
<button id="b">Clicked 0 times</button>
<link rel="stylesheet" href="style.css">
<script src="script.js"></script>
\`\`\`
\`\`\`css style.css
button { font: 600 18px system-ui; padding: 12px 20px; border-radius: 10px; border: 0; background: #4f6bed; color: white; }
\`\`\`
\`\`\`javascript script.js
let n = 0
const b = document.getElementById("b")
b.onclick = () => { n++; b.textContent = "Clicked " + n + " times" }
\`\`\`

## Languages that are shown, not run

Rust, Kotlin, Swift, PHP, Bash, YAML, JSON and many more get syntax colouring but no Run button: the browser has no runtime for them yet. They're still worth using for snippets readers copy.

\`\`\`rust main.rs
fn main() {
    let words = vec!["ink", "nib", "page"];
    let longest = words.iter().max_by_key(|w| w.len()).unwrap();
    println!("longest: {longest}");
}
\`\`\`
`,
    },
    {
      slug: "diagrams",
      title: "Diagrams: a Mermaid cheat sheet and the flowchart builder",
      summary: "Copy-paste Mermaid for flowcharts, sequences, timelines, Gantt charts, mind maps and more, and when to draw by hand instead.",
      tags: ["guide", "composer", "diagrams", "reference"],
      body: `
${"Nib"} has two diagram blocks. **Mermaid** draws a diagram from a few lines of text: quick to write, easy to change, and it lays itself out. **Flowchart** is a canvas where you place and connect boxes by hand. Use Mermaid by default; reach for Flowchart when the exact position of each box matters.

## Adding a Mermaid diagram

1. Type \`/mermaid\` and press Enter.
2. Paste one of the examples below into the box and press the block's **Preview** button.
3. Change the words. The layout follows.

!note Every diagram on this page is a live Mermaid block. Copy the text under each one into your own block as a starting point.

## Flowchart

Steps and decisions. \`TD\` runs top to bottom; use \`LR\` for left to right. \`[ ]\` is a box, \`{ }\` a decision, \`( )\` a rounded step, and \`-- text -->\` labels an arrow.

~~~mermaid A decision flow
flowchart TD
  A[Draft ready] --> B{Needs a diagram?}
  B -- yes --> C[Add a Mermaid block]
  B -- no --> D[Publish]
  C --> D
~~~

\`\`\`text flowchart.mmd
flowchart TD
  A[Draft ready] --> B{Needs a diagram?}
  B -- yes --> C[Add a Mermaid block]
  B -- no --> D[Publish]
  C --> D
\`\`\`

## Sequence diagram

Who talks to whom, in order. Solid arrows \`->>\` are calls, dashed \`-->>\` are replies.

~~~mermaid Signing in with a magic link
sequenceDiagram
  participant R as Reader
  participant A as App
  participant M as Email
  R->>A: Enter email
  A->>M: Send link
  M-->>R: Link arrives
  R->>A: Open link
  A-->>R: Signed in
~~~

\`\`\`text sequence.mmd
sequenceDiagram
  participant R as Reader
  participant A as App
  participant M as Email
  R->>A: Enter email
  A->>M: Send link
  M-->>R: Link arrives
  R->>A: Open link
  A-->>R: Signed in
\`\`\`

## Gantt chart

Plans with dates. Each task has an id, a start (a date or \`after id\`) and a length.

~~~mermaid A launch plan
gantt
  dateFormat YYYY-MM-DD
  section Write
  Outline      :a1, 2026-11-02, 3d
  Draft        :a2, after a1, 5d
  section Ship
  Edit         :a3, after a2, 2d
  Publish      :milestone, after a3, 0d
~~~

\`\`\`text gantt.mmd
gantt
  dateFormat YYYY-MM-DD
  section Write
  Outline      :a1, 2026-11-02, 3d
  Draft        :a2, after a1, 5d
  section Ship
  Edit         :a3, after a2, 2d
  Publish      :milestone, after a3, 0d
\`\`\`

## Timeline

Events by period, for history and roadmaps.

~~~mermaid A product history
timeline
  2024 : Idea : First prototype
  2025 : Private beta
  2026 : Public launch : Code blocks run in the browser
~~~

\`\`\`text timeline.mmd
timeline
  2024 : Idea : First prototype
  2025 : Private beta
  2026 : Public launch : Code blocks run in the browser
\`\`\`

## Mind map

Ideas around a centre. Indentation sets the level.

~~~mermaid Planning a talk
mindmap
  root((My talk))
    Audience
      Beginners
      Managers
    Story
      Problem
      Demo
      Ask
    Slides
~~~

\`\`\`text mindmap.mmd
mindmap
  root((My talk))
    Audience
      Beginners
      Managers
    Story
      Problem
      Demo
      Ask
    Slides
\`\`\`

## State diagram

Something that moves between states, like a piece going from draft to published.

~~~mermaid The life of a piece
stateDiagram-v2
  [*] --> Draft
  Draft --> Scheduled: schedule
  Draft --> Published: publish
  Scheduled --> Published: time arrives
  Published --> Draft: unpublish
~~~

\`\`\`text state.mmd
stateDiagram-v2
  [*] --> Draft
  Draft --> Scheduled: schedule
  Draft --> Published: publish
  Scheduled --> Published: time arrives
  Published --> Draft: unpublish
\`\`\`

## Class and entity diagrams

For software design: classes with fields and methods, or database tables and how they relate.

~~~mermaid Tables and relations
erDiagram
  AUTHOR ||--o{ PIECE : writes
  PIECE ||--|{ BLOCK : contains
  READER }o--o{ PIECE : saves
~~~

\`\`\`text er.mmd
erDiagram
  AUTHOR ||--o{ PIECE : writes
  PIECE ||--|{ BLOCK : contains
  READER }o--o{ PIECE : saves
\`\`\`

~~~mermaid Classes
classDiagram
  class Piece {
    +String title
    +publish()
  }
  class Block {
    +String type
    +render()
  }
  Piece "1" --> "many" Block
~~~

\`\`\`text class.mmd
classDiagram
  class Piece {
    +String title
    +publish()
  }
  class Block {
    +String type
    +render()
  }
  Piece "1" --> "many" Block
\`\`\`

## Pie and quadrant charts

Mermaid can draw a quick pie, and a two-by-two quadrant for prioritising. For charts from real numbers, the Chart block is better: see [Charts](/u/nib/charts).

~~~mermaid Where reading time goes
pie
  "Skim" : 45
  "Standard" : 35
  "Expert" : 20
~~~

\`\`\`text pie.mmd
pie
  "Skim" : 45
  "Standard" : 35
  "Expert" : 20
\`\`\`

~~~mermaid Effort against impact
quadrantChart
  x-axis Low effort --> High effort
  y-axis Low impact --> High impact
  quadrant-1 Plan it
  quadrant-2 Do it now
  quadrant-3 Skip it
  quadrant-4 Delegate
  Fix typos: [0.2, 0.3]
  New onboarding: [0.8, 0.85]
  Better search: [0.35, 0.75]
~~~

\`\`\`text quadrant.mmd
quadrantChart
  x-axis Low effort --> High effort
  y-axis Low impact --> High impact
  quadrant-1 Plan it
  quadrant-2 Do it now
  quadrant-3 Skip it
  quadrant-4 Delegate
  Fix typos: [0.2, 0.3]
  New onboarding: [0.8, 0.85]
  Better search: [0.35, 0.75]
\`\`\`

## When a diagram won't draw

- **Check the first line.** It names the diagram type (\`flowchart TD\`, \`sequenceDiagram\`, \`gantt\`…) and must be spelled exactly.
- **Quote labels with symbols.** Brackets, colons or parentheses inside a label confuse Mermaid: write \`A["Step (optional)"]\`.
- **Indent mind maps with spaces,** consistently.
- The full syntax lives at [mermaid.js.org](https://mermaid.js.org/intro/).

## The flowchart builder

Type \`/flowchart\` for a canvas instead. Drag a **Primary Node** or **Secondary Node** from the toolbox (on a phone, **+ Add Node**), give it a title and subtitle, and drag from one node's handle to another to connect them. Readers can pan, zoom and open it full screen. It suits site maps, org charts and anything you'd sketch on a whiteboard.

~~~block flowchart
${JSON.stringify({
  caption: "A site map drawn with the flowchart builder",
  nodes: [
    node("home", 250, 0, "Home", "Landing page", true),
    node("blog", 40, 160, "Blog", "Guides and news"),
    node("pricing", 250, 160, "Pricing", "Plans"),
    node("studio", 460, 160, "Studio", "Write and publish"),
    node("drafts", 380, 320, "Drafts"),
    node("analytics", 560, 320, "Analytics"),
  ],
  edges: [edge("home", "blog"), edge("home", "pricing"), edge("home", "studio"), edge("studio", "drafts"), edge("studio", "analytics")],
})}
~~~
`,
    },
    {
      slug: "charts",
      title: "Charts: every chart type, and which one to pick",
      summary: "Bar, line, area, pie, radar, scatter and composed charts, each with a live example and when to use it.",
      tags: ["guide", "composer", "charts", "reference"],
      body: `
A Chart block draws a real, interactive chart from numbers you type in. Readers can hover a point to see its value. Every chart on this page is a Chart block.

## Making a chart

1. Type \`/chart\` and press Enter.
2. Pick a type from the menu.
3. Under **Labels**, add the categories: months, products, survey answers.
4. Under **Series**, add one row per thing you're measuring, with a number for each label. Two series draw two bars or lines side by side.
5. Add a caption that says what the reader should notice, then press **Preview**.

!note Write the takeaway in the caption ("Signups doubled after launch") rather than describing the chart ("Signups by month"). Readers who skim read captions.

## Bar: compare categories

The default, and usually the right choice for comparing a handful of things.

${chart({ chartType: "bar", caption: "Two series compare this year with last", labels: ["Q1", "Q2", "Q3", "Q4"], series: [{ label: "2025", data: [12, 18, 15, 22] }, { label: "2026", data: [16, 24, 27, 35] }] })}

## Line: change over time

Use a line when the order of the labels matters, usually time.

${chart({ chartType: "line", caption: "Weekly readers, rising after the launch in week 4", labels: ["W1", "W2", "W3", "W4", "W5", "W6", "W7", "W8"], series: [{ label: "Readers", data: [120, 135, 128, 310, 290, 340, 365, 400] }] })}

## Area: totals over time

Like a line, with the area filled, so the eye reads volume.

${chart({ chartType: "area", caption: "Minutes read per day", labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], series: [{ label: "Minutes", data: [340, 420, 390, 450, 380, 610, 640] }] })}

## Pie: parts of a whole

Only when the parts add up to a whole and there are five or fewer. Otherwise use a bar.

${chart({ chartType: "pie", caption: "How readers choose a mode", labels: ["Skim", "Standard", "Expert", "Teach"], series: [{ label: "Share", data: [38, 34, 16, 12] }] })}

## Radar: one thing scored on several axes

Good for comparing two or three profiles across the same measures.

${chart({ chartType: "radar", caption: "Two drafts scored by reviewers", labels: ["Clarity", "Depth", "Evidence", "Tone", "Length"], series: [{ label: "Draft A", data: [8, 5, 6, 7, 9] }, { label: "Draft B", data: [6, 9, 8, 6, 5] }] })}

## Scatter: is there a relationship?

Each label is a point. Use it to show whether two measures move together.

${chart({ chartType: "scatter", caption: "Longer pieces are read for longer, up to a point", labels: ["4", "6", "8", "10", "12", "15", "20"], series: [{ label: "Minutes read", data: [3, 5, 6, 8, 8, 9, 9] }] })}

## Composed: bars and a line together

The first series draws as bars and the rest as lines. Use it for a count plus a rate.

${chart({ chartType: "composed", caption: "Signups (bars) and conversion rate (line)", labels: ["Jan", "Feb", "Mar", "Apr", "May"], series: [{ label: "Signups", data: [40, 55, 70, 65, 90] }, { label: "Conversion %", data: [8, 9, 11, 10, 13] }] })}

## Picking quickly

- Comparing a few things: **bar**.
- Something over time: **line**, or **area** for totals.
- Shares of a whole, five or fewer: **pie**.
- Profiles across the same measures: **radar**.
- Does X go with Y: **scatter**.
- A count and a rate together: **composed**.

For diagrams rather than numbers, see [Diagrams](/u/nib/diagrams).
`,
    },
    {
      slug: "cheat-sheet",
      title: "Cheat sheet: every block in one page",
      summary: "The slash command, a one-line description and a link for every block type, plus the shortcuts people forget.",
      tags: ["guide", "reference"],
      body: `
Bookmark this page. It lists every block type with the command that inserts it and where to learn more. Press \`/\` at the start of any line in the composer and type the name.

## Text

- \`/heading\`: a section title. Readers in Skim mode see every heading.
- \`/quote\`: a pulled-out quotation.
- \`/callout\`: a highlighted note, like the one below.
- \`/citation\`: a source with a title and link.
- \`/footnote\`: an aside or margin note.

!note This is a callout. Use it for the one thing a reader must not miss.

## Arguments

- \`/thesis\`: the core claim of the piece.
- \`/evidence\`: a fact that supports it.
- \`/counter\`: the strongest objection.
- \`/question\`: an open question that can start a debate.

## Media

- \`/image\`: a picture with a caption. Paste or drop an image anywhere to add one.
- \`/embed\`: YouTube, Loom, Vimeo or any link, shown inline.
- \`/audio\`: an audio or video clip.

## Code, data and diagrams

- \`/code\`: a code block that readers can run in ten languages. Examples: [every language](/u/nib/code-examples). How it works: [Code blocks](/u/nib/code-blocks).
- \`/chart\`: bar, line, area, pie, radar, scatter or composed. See [Charts](/u/nib/charts).
- \`/mermaid\`: a diagram from text. See [Diagrams](/u/nib/diagrams) for copy-paste examples.
- \`/flowchart\`: a diagram you draw by hand on a canvas.

## Teaching

- \`/exercise\`: a prompt with a hidden answer, multiple choice or a short answer that checks itself.
- \`/question\` in Teach mode: a question shown only to readers who chose Teach.

## Mermaid in one glance

\`\`\`text mermaid.mmd
flowchart LR      A[Box] --> B{Decision} -- yes --> C(Rounded)
sequenceDiagram   A->>B: call     B-->>A: reply
gantt             Task :id, 2026-11-02, 3d     Next :after id, 2d
timeline          2025 : Event : Another
mindmap           root((Centre)) then indent children
stateDiagram-v2   [*] --> Draft --> Published
erDiagram         AUTHOR ||--o{ PIECE : writes
pie               "Label" : 40
\`\`\`

## Shortcuts people forget

- \`/\` opens the block menu; keep typing to filter.
- **[[** links to one of your own pieces.
- **Ctrl+S** saves now; **Ctrl+Enter** publishes (or unpublishes a live piece).
- **Ctrl+E** makes inline code, **Ctrl+Shift+H** highlights.
- Every shortcut: [Keyboard shortcuts](/u/nib/keyboard-shortcuts).
`,
    },
  ]
}
