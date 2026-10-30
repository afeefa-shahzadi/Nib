/**
 * Feature guides for the official blog, seeded by seed_official_blog.ts.
 * Same markdown dialect as posts() there (see the converter's header comment).
 * Code, Mermaid and JSON chunks must not contain blank lines: blank lines split chunks.
 */

type Post = { slug: string; title: string; summary: string; tags: string[]; body: string }

const block = (type: string, content: Record<string, unknown>) => `~~~block ${type}\n${JSON.stringify(content)}\n~~~`
const chart = (content: Record<string, unknown>) => block("chart", content)
const rich = (text: string) => ({ text, html: `<p>${text}</p>` })

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
    {
      slug: "teaching-blocks",
      title: "Teaching blocks: exercises, quizzes, polls and questions",
      summary: "Every exercise type with a live example: multiple choice, select all, matching, fill in the blanks, short answer and polls.",
      tags: ["guide", "composer", "teaching", "reference"],
      body: `
An **Exercise** block asks the reader to do something before they see the answer. Readers answer in place, press **Check answer**, and see your solution. Answers aren't graded and stay in the reader's browser, except poll votes, which are counted so everyone sees the results. It's practice, for them. Every exercise on this page is live, so try them.

## Adding one

1. Type \`/exercise\` and press Enter.
2. Pick a type, write the prompt, then fill in the options or the answer.
3. Add a hint if you like. Readers can open it before answering.

## Multiple choice

One right answer. Mark it as correct in the editor.

${block("exercise", { exerciseType: "multiple_choice", prompt: "Which chart suits change over time best?", hint: "Think about what the order of the labels means.", options: [{ id: "a", text: "Pie" }, { id: "b", text: "Line", isCorrect: true }, { id: "c", text: "Radar" }], answer: "A line chart, because the order of the labels (time) matters." })}

## Select all that apply

Several right answers. The reader ticks every one they think is correct.

${block("exercise", { exerciseType: "multi_select", prompt: "Which of these languages can a code block run?", options: [{ id: "a", text: "Python", isCorrect: true }, { id: "b", text: "Rust" }, { id: "c", text: "Go", isCorrect: true }, { id: "d", text: "SQL", isCorrect: true }] })}

## Matching

Pairs. Readers match each item on the left to one on the right.

${block("exercise", { exerciseType: "matching", prompt: "Match each Mermaid diagram to what it shows.", options: [{ id: "a", text: "sequenceDiagram", pairText: "Who talks to whom, in order" }, { id: "b", text: "gantt", pairText: "Tasks on a calendar" }, { id: "c", text: "mindmap", pairText: "Ideas around a centre" }] })}

## Fill in the blanks

Write the sentence with blanks in the prompt and the missing words in the answer.

${block("exercise", { exerciseType: "fill_in_the_blanks", prompt: "A piece is made of ____. Readers choose a reading ____, such as Skim or Expert.", answer: "blocks, mode" })}

## Short answer

An open question. The reader writes an answer, then sees yours to compare.

${block("exercise", { exerciseType: "short_answer", prompt: "In one sentence: when would you draw a flowchart by hand instead of using Mermaid?", answer: "When the exact position of each box matters, such as a site map or an org chart you want laid out a particular way." })}

## Poll

No right answer: readers pick an option, press **Submit vote**, and see how everyone else voted. Use it to get readers thinking about where they stand before the argument starts.

${block("exercise", { exerciseType: "poll", prompt: "How do you usually read a long guide?", options: [{ id: "a", text: "Skim the headings first" }, { id: "b", text: "Top to bottom" }, { id: "c", text: "Jump to the part I need" }] })}

## Question blocks

A **Question** block (\`/question\`) is an open question in the flow of the piece. It doesn't check an answer; it invites readers to think, and it can start a debate. Show it in **Teach** mode only, from the block's mode settings, to keep it out of the way of readers who skim.

${block("question", rich("What is one thing in your field that readers always get wrong, and how would you test for it?"))}

## Making a lesson

- Put an exercise straight after the idea it tests, not at the end.
- Use the hint for the first step, not the answer.
- Write a solution that explains *why*, so a wrong answer still teaches.
- Mix types: a multiple choice to check recall, a short answer to check understanding.
`,
    },
    {
      slug: "rich-blocks",
      title: "Rich blocks: callouts, quotes, citations, embeds, audio and images",
      summary: "The blocks that make a piece easier to read and easier to trust, with what each looks like and when to use it.",
      tags: ["guide", "composer", "reference"],
      body: `
These blocks don't run or compute anything. They make a piece easier to scan and easier to trust. Each one is a \`/\` command away.

## Callout: the one thing not to miss

Type \`/callout\`. Use one or two per piece; a page of callouts is a page of noise.

!note Callouts are hidden in Skim mode by default, so put anything a skimmer must see in a heading or the first paragraph of a section too.

## Quote: a line worth pausing on

Type \`/quote\` for a pulled-out quotation in large type.

${block("quote", rich("Write the piece once. Let each reader choose how much of it they need."))}

## Citation: show where a claim comes from

Type \`/citation\` and fill in the **source**, a **link**, and optionally the exact **quote** and **page**. Readers can follow the link to check you. Use one wherever a reader might ask "says who?".

${block("citation", { source: "Mermaid documentation", url: "https://mermaid.js.org/intro/", quote: "Mermaid lets you create diagrams and visualizations using text and code." })}

## Embed: video and links inline

Type \`/embed\` and paste a link. YouTube, Vimeo and Loom play in the page; other links show as a card. Add a title so readers know what they're about to watch.

## Audio and video clips

Type \`/audio\` to add a clip. Add a **transcript**: readers who can't listen can read it, and search can find it.

## Images

Paste or drop an image anywhere in the composer, or type \`/image\`. Always fill in the **alt text** (what the image shows, for readers using screen readers) and add a caption when the image needs explaining. Images are hidden in Skim mode, so don't put the only copy of an important fact in one.

## Headings

Type \`/heading\`. Headings are what Skim readers see first and what the outline is built from, so make each one say something: "Costs doubled in March" beats "Results".

## Which block when

- The reader must not miss it: **callout**.
- A line worth remembering: **quote**.
- A claim someone could doubt: **citation**.
- Something to watch or hear: **embed** or **audio**.
- Something to see: **image**, with alt text.
- More: [Charts](/u/nib/charts), [Diagrams](/u/nib/diagrams), [Teaching blocks](/u/nib/teaching-blocks), and the [cheat sheet](/u/nib/cheat-sheet).
`,
    },
    {
      slug: "nib-for-software-engineers",
      title: "Nib for software engineers",
      summary: "Write tutorials, design docs and postmortems that readers can run: multi-file code, architecture diagrams and Expert mode.",
      tags: ["guide", "roles", "code"],
      body: `
Technical writing has two audiences at once: the person who needs the idea and the person who needs the details. Here you write once and both get what they came for.

## What you can do

- **Runnable code.** Readers press Run and see output, in ten languages, with several files per block. No setup, nothing to host.
- **Architecture as text.** Mermaid sequence, class and ER diagrams live next to the prose and change in a line.
- **Two depths in one piece.** Put the implementation detail in Expert mode and the overview in Standard.
- **Exercises** that check understanding, for tutorials and onboarding.

## A worked example: explaining a cache

A reader learning caching sees the idea first.

~~~mermaid Read-through cache
sequenceDiagram
  participant C as Client
  participant K as Cache
  participant D as Database
  C->>K: get(user:42)
  K-->>C: miss
  C->>D: SELECT user 42
  D-->>C: row
  C->>K: set(user:42)
~~~

Then runs it, and sees five reads cost two database calls.
>expert In production, bound the cache (LRU or TTL), and decide what happens when two requests miss at once: without a lock or request coalescing, both hit the database.

\`\`\`python main.py
from cache import Cache
calls = 0
def load(key):
    global calls
    calls += 1
    return key.upper()
c = Cache(load)
for k in ["a", "b", "a", "a", "b"]:
    c.get(k)
print("database calls:", calls)
\`\`\`
\`\`\`python cache.py
class Cache:
    def __init__(self, loader):
        self.loader, self.data = loader, {}
    def get(self, key):
        if key not in self.data:
            self.data[key] = self.loader(key)
        return self.data[key]
\`\`\`

## Good pieces to write here

- Tutorials where the reader runs every step.
- Design docs with sequence and ER diagrams.
- Postmortems with a timeline diagram and an Expert-mode appendix.
- Interview prep with exercises.

## Start here

Read [Code blocks](/u/nib/code-blocks), keep [examples in every language](/u/nib/code-examples) open, and copy diagrams from [Diagrams](/u/nib/diagrams).
`,
    },
    {
      slug: "nib-for-educators",
      title: "Nib for teachers and educators",
      summary: "Turn a lesson into a piece that teaches: Teach mode, self-checking exercises, diagrams and charts.",
      tags: ["guide", "roles", "teaching"],
      body: `
A good lesson explains, shows, then checks. There's a block for each step, and a **Teach** reading mode that keeps the scaffolding for learners and hides it from everyone else.

## What you can do

- **Teach mode.** Write a simpler version of any paragraph for learners, and questions shown only to them.
- **Exercises** that check themselves: multiple choice, select all, matching, fill in the blanks, short answer.
- **Diagrams and charts** that explain at a glance.
- **Runnable code** for computing lessons, with nothing to install.

## A worked example: a five-minute lesson on photosynthesis

~~~mermaid What a leaf does
flowchart LR
  S[Sunlight] --> L((Leaf))
  W[Water] --> L
  C[Carbon dioxide] --> L
  L --> G[Glucose]
  L --> O[Oxygen]
~~~

${block("exercise", { exerciseType: "multiple_choice", prompt: "Which gas does a leaf release in sunlight?", hint: "Look at the arrows leaving the leaf.", options: [{ id: "a", text: "Carbon dioxide" }, { id: "b", text: "Oxygen", isCorrect: true }, { id: "c", text: "Nitrogen" }], answer: "Oxygen. The leaf takes in carbon dioxide and gives out oxygen." })}

${block("exercise", { exerciseType: "fill_in_the_blanks", prompt: "Plants turn sunlight, water and ____ into glucose and ____.", answer: "carbon dioxide, oxygen" })}

## Good pieces to write here

- Lessons with a check after each idea.
- Revision sheets in Skim mode, full notes in Standard.
- Reading lists as a collection, in the order to read them.

## Start here

[Teaching blocks](/u/nib/teaching-blocks) has every exercise type. [Diagrams](/u/nib/diagrams) and [Charts](/u/nib/charts) cover the visuals.
`,
    },
    {
      slug: "nib-for-marketers",
      title: "Nib for marketers",
      summary: "Publish launch plans, campaign reports and customer stories with real charts, polls and embedded video.",
      tags: ["guide", "roles", "marketing"],
      body: `
Marketing writing has to prove its point fast. Lead with the number, show the chart, and let the reader who wants the method open it.

## What you can do

- **Charts from real numbers**, with the takeaway in the caption.
- **Polls** that get readers to commit to a view before you make your case.
- **Embeds** for product videos and Looms.
- **Skim mode** for the executive who reads headings only.
- **Scheduling**, so a launch post goes live on the day.

## A worked example: a launch report

~~~mermaid The launch plan
gantt
  dateFormat YYYY-MM-DD
  section Prepare
  Landing page   :a1, 2026-11-02, 4d
  Email sequence :a2, after a1, 3d
  section Launch
  Launch day     :milestone, after a2, 0d
  Paid social    :a3, after a2, 7d
~~~

${chart({ chartType: "composed", caption: "Signups more than doubled in launch week while conversion held", labels: ["Week 1", "Week 2", "Launch", "Week 4"], series: [{ label: "Signups", data: [120, 140, 330, 290] }, { label: "Conversion %", data: [3.1, 3.3, 3.6, 3.4] }] })}

${block("exercise", { exerciseType: "poll", prompt: "Which channel do you think drove launch week?", options: [{ id: "a", text: "Email" }, { id: "b", text: "Paid social" }, { id: "c", text: "Word of mouth" }] })}

## Good pieces to write here

- Launch announcements and changelogs.
- Campaign reports with the takeaway in the chart caption.
- Customer stories with an embedded interview.
- Market notes with citations for every number.

## Start here

[Charts](/u/nib/charts) for picking the right chart, [Rich blocks](/u/nib/rich-blocks) for embeds and citations, and Gantt and quadrant charts in [Diagrams](/u/nib/diagrams).
`,
    },
    {
      slug: "nib-for-presenters",
      title: "Nib for presenters and speakers",
      summary: "Turn a talk into a piece people read afterwards: diagrams instead of slides, charts with the takeaway, and headings that follow your story.",
      tags: ["guide", "roles", "presenting"],
      body: `
The talk lasts forty minutes; the write-up is what people share. Publish the talk as a piece that works without you in the room.

## What you can do

- **Plan the talk** with a Mermaid mind map, then write a section per branch.
- **Diagrams and charts** in place of slides, readable on a phone.
- **Embed the recording** at the top.
- **Skim mode** gives readers the talk's outline in a minute: the headings are your slides.

## A worked example: planning a talk

~~~mermaid Plan the story before the slides
mindmap
  root((Why our releases got faster))
    The problem
      Two-week cycles
      Manual testing
    What we changed
      Smaller changes
      Automated checks
    The result
      Daily releases
    The ask
~~~

${chart({ chartType: "bar", caption: "Releases per month went from 2 to 21 in a quarter", labels: ["Jan", "Feb", "Mar", "Apr"], series: [{ label: "Releases", data: [2, 6, 14, 21] }] })}

!note Write each heading as the sentence you'd put on a slide: "Releases went from 2 to 21 a month", not "Results".

## Good pieces to write here

- The write-up of a talk, with the video embedded.
- Workshop handouts with exercises.
- Speaker notes as a private draft, published after the event.

## Start here

[Diagrams](/u/nib/diagrams) for mind maps and timelines, [Charts](/u/nib/charts) for numbers, and [Keyboard shortcuts](/u/nib/keyboard-shortcuts) to write faster.
`,
    },
    {
      slug: "nib-for-researchers",
      title: "Nib for researchers and students",
      summary: "Publish findings with citations, charts from your data, runnable analysis and an Expert mode for the method.",
      tags: ["guide", "roles", "research"],
      body: `
Research writing is read by people who want the finding and people who want to check it. Write the finding in Standard, put the method in Expert, and cite everything.

## What you can do

- **Citations** with a source, link, quote and page.
- **Charts** from your data, with the takeaway in the caption.
- **Runnable analysis** in Python or SQL, so a reader can rerun your numbers.
- **Expert mode** for methods, assumptions and caveats.
- **Diagrams** for study designs and pipelines.

## A worked example: a small finding

${chart({ chartType: "scatter", caption: "Study time and score rise together until about 15 hours", labels: ["2", "5", "8", "10", "12", "15", "20"], series: [{ label: "Score", data: [52, 61, 70, 74, 80, 84, 85] }] })}

Press Run to recompute the correlation from the same numbers.
>expert Seven points show a trend, not a law. Correlation says nothing about cause, and the flattening after 15 hours needs more data at the top of the range to tell apart from noise.

\`\`\`python analysis.py
hours = [2, 5, 8, 10, 12, 15, 20]
score = [52, 61, 70, 74, 80, 84, 85]
n = len(hours)
mx, my = sum(hours) / n, sum(score) / n
cov = sum((x - mx) * (y - my) for x, y in zip(hours, score))
sx = sum((x - mx) ** 2 for x in hours) ** 0.5
sy = sum((y - my) ** 2 for y in score) ** 0.5
print("correlation:", round(cov / (sx * sy), 3))
\`\`\`

## Good pieces to write here

- Paper summaries with the full method in Expert mode.
- Lab notes with runnable analysis.
- Literature reviews as a collection, one piece per paper.
- Study guides with exercises for revision.

## Start here

[Rich blocks](/u/nib/rich-blocks) for citations, [Charts](/u/nib/charts), and [examples in every language](/u/nib/code-examples) for Python and SQL.
`,
    },
    {
      slug: "nib-for-writers",
      title: "Nib for writers and journalists",
      summary: "Essays, reporting and newsletters with reading modes, sourcing, imports from Substack and Medium, and readers who respond.",
      tags: ["guide", "roles", "writing"],
      body: `
You already know how to write. This adds what a page can't: a version for the reader in a hurry, sources a reader can check, and readers who argue back in the open.

## What you can do

- **Reading modes.** A Skim version for the busy reader, the full piece for everyone else.
- **Citations and quotes** that show your sourcing.
- **Timelines** for reporting that spans months.
- **Import** your back catalogue from Substack, Medium or Markdown.
- **Debates, branches and comments** where readers respond to a specific paragraph.

## A worked example: a story that spans a year

~~~mermaid How the story unfolded
timeline
  January : Complaints start
  March : Council review
  June : Report published : Two officials resign
  October : New rules take effect
~~~

${block("quote", rich("We didn't know the numbers until a reader sent them to us."))}

!note Put the news in the first paragraph of each section. Skim mode keeps headings and those first paragraphs, so a skimmer still gets the story.

## Good pieces to write here

- Essays with a Skim version.
- Investigations with a timeline and citations.
- Newsletters, with readers following you for new pieces.

## Start here

[The composer guide](/u/nib/composer-guide), [Importing your writing](/u/nib/importing-your-writing), and [Rich blocks](/u/nib/rich-blocks) for quotes and citations.
`,
    },
  ]
}

// Reading lists curated by the official account, one per role. Items are post slugs, in reading order.
export const roleCollections: { title: string; description: string; slugs: string[] }[] = [
  { title: "For software engineers", description: "Runnable code, architecture diagrams and technical writing.", slugs: ["nib-for-software-engineers", "code-blocks", "code-examples", "diagrams", "importing-your-writing", "keyboard-shortcuts"] },
  { title: "For teachers and educators", description: "Lessons that explain, show and check.", slugs: ["nib-for-educators", "teaching-blocks", "diagrams", "charts", "composer-guide", "cheat-sheet"] },
  { title: "For marketers", description: "Launches, reports and customer stories with real numbers.", slugs: ["nib-for-marketers", "charts", "rich-blocks", "diagrams", "plans-explained"] },
  { title: "For presenters and speakers", description: "Turn a talk into a piece people read and share.", slugs: ["nib-for-presenters", "diagrams", "charts", "rich-blocks", "keyboard-shortcuts"] },
  { title: "For researchers and students", description: "Findings with citations, data and runnable analysis.", slugs: ["nib-for-researchers", "rich-blocks", "charts", "code-examples", "teaching-blocks"] },
  { title: "For writers and journalists", description: "Essays, reporting and newsletters.", slugs: ["nib-for-writers", "composer-guide", "importing-your-writing", "rich-blocks", "community-features", "reading-and-discovery"] },
]
