const config = `backend:
  name: github
  repo: JJB9/ArgentinaMetals-Website
  branch: main

local_backend: true

media_folder: "public/uploads"
public_folder: "/uploads"

collections:
  - name: "news"
    label: "News"
    folder: "src/content/news"
    create: true
    slug: "{{year}}-{{month}}-{{day}}-{{slug}}"
    fields:
      - { label: "Title", name: "title", widget: "string" }
      - { label: "Date", name: "date", widget: "datetime", format: "YYYY-MM-DD" }
      - label: "Category"
        name: "category"
        widget: "select"
        options: ["Press Release", "Corporate", "Technical"]
      - { label: "Excerpt", name: "excerpt", widget: "text" }
      - { label: "Draft", name: "draft", widget: "boolean", default: false }
      - { label: "Body", name: "body", widget: "markdown" }
`;

export function GET() {
  return new Response(config, {
    headers: {
      "Content-Type": "text/yaml; charset=utf-8"
    }
  });
}
