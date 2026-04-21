const config = `backend:
  name: git-gateway
  branch: main

local_backend: true

media_folder: "public/assets/uploads"
public_folder: "/assets/uploads"

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
        options: ["Press Release", "Corporate Update", "Technical"]
      - { label: "Excerpt", name: "excerpt", widget: "text" }
      - { label: "Image", name: "image", widget: "string", required: false }
      - { label: "Image Alt", name: "imageAlt", widget: "string", required: false }
      - { label: "Read Time", name: "readTime", widget: "string", required: false }
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
