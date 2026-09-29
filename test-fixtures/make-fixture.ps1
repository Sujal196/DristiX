$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$dir = 'C:\SHIVAM UI WORK\DristiX\test-fixtures'
New-Item -ItemType Directory -Force -Path $dir | Out-Null
$path = Join-Path $dir 'sample-questions.docx'
if (Test-Path $path) { Remove-Item $path -Force }

$contentTypes = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>
'@

$rels = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>
'@

$document = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>
<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Quantitative Aptitude</w:t></w:r></w:p>
<w:p><w:r><w:t>1. What is 2 + 2?</w:t></w:r></w:p>
<w:p><w:r><w:t>(a) 3   (b) 4   (c) 5   (d) 6</w:t></w:r></w:p>
<w:p><w:r><w:t>Ans: b</w:t></w:r></w:p>
<w:p><w:r><w:t>Solution: Basic addition of two natural numbers.</w:t></w:r></w:p>
<w:p><w:r><w:t>Q2) The capital of France is?</w:t></w:r></w:p>
<w:p><w:r><w:t>a) Berlin</w:t></w:r></w:p>
<w:p><w:r><w:t>b) Paris</w:t></w:r></w:p>
<w:p><w:r><w:t>c) Rome</w:t></w:r></w:p>
<w:p><w:r><w:t>d) Madrid</w:t></w:r></w:p>
<w:p><w:r><w:t>Answer: (b)</w:t></w:r></w:p>
<w:p><w:r><w:t>Hint: It is also called the City of Light.</w:t></w:r></w:p>
<w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t>Measurement</w:t></w:r></w:p>
<w:p><w:r><w:t>3) 100 cm is equal to?</w:t></w:r></w:p>
<w:p><w:r><w:t>1) 1 m</w:t></w:r></w:p>
<w:p><w:r><w:t>2) 10 m</w:t></w:r></w:p>
<w:p><w:r><w:t>3) 100 m</w:t></w:r></w:p>
<w:p><w:r><w:t>4) 0.1 m</w:t></w:r></w:p>
<w:p><w:r><w:t>Answer Key</w:t></w:r></w:p>
<w:p><w:r><w:t>1. B   2. B   3. A</w:t></w:r></w:p>
</w:body>
</w:document>
'@

$zip = [System.IO.Compression.ZipFile]::Open($path, 'Create')
function Add-Entry([string]$name, [string]$content) {
  $entry = $script:zip.CreateEntry($name, [System.IO.Compression.CompressionLevel]::Optimal)
  $stream = $entry.Open()
  $bytes = [Text.Encoding]::UTF8.GetBytes($content)
  $stream.Write($bytes, 0, $bytes.Length)
  $stream.Dispose()
}
Add-Entry '[Content_Types].xml' $contentTypes
Add-Entry '_rels/.rels' $rels
Add-Entry 'word/document.xml' $document
$zip.Dispose()

"created: $path ($((Get-Item $path).Length) bytes)"
