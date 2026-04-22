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

  - name: "investor"
    label: "Investor Documents"
    editor:
      preview: false
    files:
      - name: "corporate"
        label: "Corporate Documents"
        file: "src/data/investor/corporate.json"
        fields:
          - label: "Corporate Presentation (PDF)"
            name: "corporatePresentation"
            widget: "file"
            required: false
            media_folder: "/public/assets/documents"
            public_folder: "/assets/documents"
            hint: "Leave empty to disable the download link."
          - label: "Fact Sheet / 1-Pager (PDF)"
            name: "factSheet"
            widget: "file"
            required: false
            media_folder: "/public/assets/documents"
            public_folder: "/assets/documents"
            hint: "Leave empty to disable the download link."
          - label: "NI 43-101 Technical Report (PDF)"
            name: "technicalReport"
            widget: "file"
            required: false
            media_folder: "/public/assets/documents"
            public_folder: "/assets/documents"
            hint: "Leave empty to disable the download link."

      - name: "financial"
        label: "Financial Statements"
        file: "src/data/investor/financial.json"
        fields:
          - label: "Annual Financial Statements / Audited (PDF)"
            name: "annualFinancialStatements"
            widget: "file"
            required: false
            media_folder: "/public/assets/documents"
            public_folder: "/assets/documents"
            hint: "Leave empty to disable the download link."
          - label: "Annual Financial Statements – Period Label"
            name: "annualFinancialStatementsPeriod"
            widget: "string"
            required: true
            default: "FY2025"
            hint: "Shown next to the link, e.g. 'FY2025' or 'FY2026'."
          - label: "Interim Financial Statements (PDF)"
            name: "interimFinancialStatements"
            widget: "file"
            required: false
            media_folder: "/public/assets/documents"
            public_folder: "/assets/documents"
            hint: "Leave empty to disable the download link."
          - label: "Interim Financial Statements – Period Label"
            name: "interimFinancialStatementsPeriod"
            widget: "string"
            required: true
            default: "Q1 2026"
            hint: "Shown next to the link, e.g. 'Q1 2026', 'Q2 2026', 'Q3 2026'."
          - label: "Management Discussion & Analysis / MD&A (PDF)"
            name: "mda"
            widget: "file"
            required: false
            media_folder: "/public/assets/documents"
            public_folder: "/assets/documents"
            hint: "Leave empty to disable the download link."
          - label: "MD&A – Period Label"
            name: "mdaPeriod"
            widget: "string"
            required: true
            default: "Q1 2026"
            hint: "Shown next to the link, e.g. 'Q1 2026'."

      - name: "regulatory"
        label: "Regulatory Filings"
        file: "src/data/investor/regulatory.json"
        fields:
          - label: "Prospectus (PDF)"
            name: "prospectus"
            widget: "file"
            required: false
            media_folder: "/public/assets/documents"
            public_folder: "/assets/documents"
            hint: "Leave empty to disable the download link."
          - label: "Prospectus – Label"
            name: "prospectusPeriod"
            widget: "string"
            required: true
            default: "TSXV Listing"
            hint: "Shown next to the link, e.g. 'TSXV Listing'."
          - label: "Information Circular / Proxy (PDF)"
            name: "informationCircular"
            widget: "file"
            required: false
            media_folder: "/public/assets/documents"
            public_folder: "/assets/documents"
            hint: "Leave empty to disable the download link."
          - label: "Information Circular – AGM Label"
            name: "informationCircularPeriod"
            widget: "string"
            required: true
            default: "AGM 2026"
            hint: "Shown next to the link, e.g. 'AGM 2026'."
`;

export function GET() {
  return new Response(config, {
    headers: {
      "Content-Type": "text/yaml; charset=utf-8"
    }
  });
}
