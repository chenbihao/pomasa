#!/bin/bash
# export.sh - Export final report to DOCX and PDF

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
OUTPUT_DIR="${PROJECT_ROOT}/_output"

# Parse arguments
LANG="cn"
INPUT_FILE=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --lang)
            LANG="$2"
            shift 2
            ;;
        *)
            INPUT_FILE="$1"
            shift
            ;;
    esac
done

# Default input file
INPUT_FILE="${INPUT_FILE:-${PROJECT_ROOT}/workspace/03.report/final_report.md}"

if [ ! -f "$INPUT_FILE" ]; then
    echo "Error: Input file not found: $INPUT_FILE"
    exit 1
fi

# Extract title from first heading
TITLE=$(grep -m 1 '^# ' "$INPUT_FILE" | sed 's/^# //')
if [ -z "$TITLE" ]; then
    echo "Error: No title found (expected '# Title' on first content line)"
    exit 1
fi

# Sanitize title for filename (replace invalid chars with -)
SAFE_TITLE=$(echo "$TITLE" | sed 's/[:<>"|?*\/\\]/-/g' | sed 's/  */ /g')

# Add timestamp
TIMESTAMP=$(date +"%Y%m%d-%H%M%S")
BASENAME="${SAFE_TITLE} [${TIMESTAMP}]"

# Ensure output directory exists
mkdir -p "$OUTPUT_DIR"

# Template files
DOCX_TEMPLATE="${SCRIPT_DIR}/docx-template.docx"

# Select LaTeX header by language
LATEX_HEADER="${SCRIPT_DIR}/latex-header.tex"
if [ "$LANG" = "en" ]; then
    LATEX_HEADER="${SCRIPT_DIR}/latex-header-en.tex"
    echo "Using English PDF template (block paragraphs, no indent)"
else
    echo "Using Chinese PDF template (first-line indentation)"
fi

# Export to DOCX
echo "Exporting to DOCX..."
if [ -f "$DOCX_TEMPLATE" ]; then
    pandoc "$INPUT_FILE" \
        --reference-doc="$DOCX_TEMPLATE" \
        -o "${OUTPUT_DIR}/${BASENAME}.docx"
else
    pandoc "$INPUT_FILE" \
        -o "${OUTPUT_DIR}/${BASENAME}.docx"
fi
echo "Created: ${OUTPUT_DIR}/${BASENAME}.docx"

# Export to PDF
echo "Exporting to PDF..."
if [ -f "$LATEX_HEADER" ]; then
    pandoc "$INPUT_FILE" \
        --pdf-engine=xelatex \
        -H "$LATEX_HEADER" \
        -o "${OUTPUT_DIR}/${BASENAME}.pdf"
else
    pandoc "$INPUT_FILE" \
        --pdf-engine=xelatex \
        -o "${OUTPUT_DIR}/${BASENAME}.pdf"
fi
echo "Created: ${OUTPUT_DIR}/${BASENAME}.pdf"

echo "Export complete!"