# Bank-to-Tally Import (AI)

Convert bank statements (PDF, Images, Excel, CSV) into Tally-importable XML with AI-powered extraction.

![Bank to Tally](https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)

## Features

- 📄 **Multiple Formats**: CSV, Excel (XLS/XLSX), PDF, and Images (JPG/PNG)
- 🤖 **AI-Powered**: Uses Gemini or Groq for intelligent extraction from PDFs and images
- 📊 **Smart Parsing**: Auto-detects columns in bank statements
- ✏️ **Editable Preview**: Review and correct transactions before export
- 📥 **Multiple Exports**: Tally XML, JSON, CSV, Excel
- 🎨 **Modern UI**: Beautiful dark theme with responsive design

## Quick Start

```bash
# Clone the repository
git clone https://github.com/your-username/bank-to-tally.git
cd bank-to-tally

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Add your API key (optional - for PDF/Image processing)
# Edit .env and set GEMINI_API_KEY or GROQ_API_KEY

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Environment Configuration

Copy `.env.example` to `.env` and configure:

```env
# AI Provider: gemini | groq | none
AI_PROVIDER=gemini

# Gemini API (get from https://aistudio.google.com/app/apikey)
GEMINI_API_KEY=your_api_key_here
GEMINI_MODEL=gemini-1.5-flash

# Groq API (get from https://console.groq.com)
GROQ_API_KEY=your_api_key_here
GROQ_MODEL=meta-llama/llama-4-scout-17b-16e-instruct
```

> **Note**: AI is only required for PDF and Image processing. CSV and Excel files work without any API key.

## Supported File Types

| Format | Processing | AI Required |
|--------|------------|-------------|
| CSV | Client-side | ❌ No |
| Excel (XLS/XLSX) | Client-side | ❌ No |
| PDF | Server-side | ✅ Yes |
| Images (JPG/PNG) | Server-side | ✅ Yes (Gemini Vision) |

## Tally XML Output

The generated XML follows Tally's import format:

- **Payment**: When debit > 0 (money going out)
- **Receipt**: When credit > 0 (money coming in)
- **Contra**: Bank-to-bank transfers

### Ledger Rules

You can configure automatic ledger mapping by adding rules. Example rules (to be implemented in UI):

```json
{
  "ledgerRules": [
    {
      "keywords": ["salary", "payroll"],
      "ledgerName": "Salary Expense",
      "voucherType": "Payment"
    },
    {
      "keywords": ["rent", "office rent"],
      "ledgerName": "Rent Expense",
      "voucherType": "Payment"
    },
    {
      "keywords": ["sales", "invoice"],
      "ledgerName": "Sales - Direct",
      "voucherType": "Receipt"
    }
  ]
}
```

## Project Structure

```
bank-to-tally/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── parse-pdf/route.ts    # PDF processing endpoint
│   │   │   └── parse-image/route.ts  # Image processing endpoint
│   │   ├── page.tsx                  # Main page
│   │   ├── layout.tsx                # Root layout
│   │   └── globals.css               # Styles
│   ├── components/
│   │   ├── FileUpload.tsx            # Drag-drop upload
│   │   ├── TransactionTable.tsx      # Editable table
│   │   └── ExportPanel.tsx           # Export options
│   └── lib/
│       ├── schema.ts                 # Zod schemas
│       ├── utils.ts                  # Utilities
│       ├── tally-xml.ts              # XML generator
│       ├── parsers/
│       │   ├── csv-parser.ts         # CSV parsing
│       │   └── excel-parser.ts       # Excel parsing
│       └── ai/
│           ├── ai-client.ts          # AI abstraction
│           └── prompts.ts            # Extraction prompts
├── samples/
│   └── sample-bank-statement.csv     # Test file
├── package.json
├── .env.example
└── README.md
```

## Development

```bash
# Run development server
npm run dev

# Run tests
npm test

# Build for production
npm run build

# Start production server
npm start
```

## Testing

Use the sample file in `samples/sample-bank-statement.csv` to test the application.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## License

MIT License - feel free to use in your projects.

## Acknowledgments

- [Next.js](https://nextjs.org/) - React Framework
- [PapaParse](https://www.papaparse.com/) - CSV Parsing
- [SheetJS](https://sheetjs.com/) - Excel Parsing
- [Gemini API](https://ai.google.dev/) - AI Extraction
- [Groq](https://groq.com/) - Fast AI Inference
