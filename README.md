# Geckodupe

[![GitHub](https://img.shields.io/badge/GitHub-Gekodupe-181717?logo=github)](https://github.com/orgs/Gekodupe/repositories)

 
## About

  Geckodupe is a browser-based deduplication tool. You paste text, upload
  a file, load a folder or zip, or drop a photo and video library. Pick
  your options, click Deduplicate, and get clean output. Everything runs on
  your machine. Nothing is uploaded to a server.

  Most compare tools only remove exact duplicates. Geckodupe goes further:
  repeated log lines with new timestamps, spreadsheet rows that mean the
  same thing, JSON with keys in a different order, renamed photo copies,
  burst camera frames, and trimmed video clips can all be caught depending
  on which tab you use and how strict you set similarity.

  The app has three main workflows: **Text/File** for single files and
  pasted data, **Folder/Zip** for whole projects and archives, and
  **Img/Vid** for visual duplicate detection in photo and video libraries.


What it is for
--------------

  **Clean up messy exports and lists.** Remove duplicate rows from a CSV
  or Excel file before importing into another tool. Collapse repeated lines
  in a todo list, markdown file, or pasted text dump.

  **Shrink noisy log and SQL files.** Strip timestamps, request IDs, and
  serial numbers so the same error message only appears once. Useful after
  debugging sessions or when sharing logs with a team.

  **Deduplicate a project folder.** Find identical files copied across
  paths, remove repeated lines inside spreadsheets and data files, and
  download a cleaned zip. Handy for archives, coursework folders, data
  bundles, and repo exports before you share or back them up.

  **Thin out photo and video libraries.** Find near-duplicate images and
  clips even when filenames differ. Collapse burst sequences from a camera
  roll, resized exports, and re-encoded videos without sending your files
  to the cloud.

  **Work privately on sensitive data.** Because processing stays in the
  browser, spreadsheets, logs, code, and personal media never leave your
  device.


Text / File
-----------

  Use this tab when you have one file or a block of pasted text.

  Geckodupe splits input into lines, normalizes them, and keeps one copy
  of each unique entry. You can ignore capitals, punctuation, extra
  whitespace, and markdown list bullets. A similarity slider lets you match
  near-duplicates, not just exact lines. At 100% similarity only exact
  matches count after normalization.

  **Formats supported**

        txt, md, markdown          plain text and lists

        xlsx, xls                  spreadsheets (header row kept)

        csv, tsv                   tabular data

        json, jsonl, yaml, yml       canonical key matching

        log, sql                   timestamps and IDs stripped first

        py, js, ts, html, css, sh  code and scripts

        todo, list                 checkbox state and status prefixes

  **Typical workflow**

        1. Paste data or upload a file
        2. Set format (or leave on auto-detect)
        3. Adjust similarity and filters
        4. Click Deduplicate
        5. Copy or download the result

  **Useful options**

        Stack duplicates          show x2, x3 counts on kept lines

        Ignore capitals           treat Hello and hello as the same

        Similarity slider         fuzzy word overlap below 100%

        Ignore punctuation        match lines that differ only by . , ? etc.


Folder / Zip
------------

  Use this tab when you have a whole directory or zip archive to clean.

  Geckodupe walks the file tree, fingerprints each file, and routes it to
  the right text engine (CSV, JSON, code, logs, and so on). Identical
  files across different paths are grouped and only one copy is kept.
  Line dedupe runs inside each file. With cross-file dedupe enabled, the
  same row in two spreadsheets only survives once.

  Built-in skips ignore `node_modules`, `.git`, `dist`, and `vendor`.
  You can add your own skip paths so specific folders or files stay
  untouched. Download a cleaned `.zip` when the run finishes.

  **What it handles**

        Duplicate files            byte-identical copies in different paths

        Lines within files         same logic as Text / File per format

        Cross-file line dedupe     repeated rows across the whole project

        Spreadsheets in archives   xlsx inside zips is supported

  **Typical workflow**

        1. Drop a folder or zip onto the tab
        2. Choose project mode and scope options
        3. Add manual skip paths if needed
        4. Click Deduplicate
        5. Download the cleaned archive

  **Markers inside files**

        geckodupe: keep          leave a whole file unchanged

        geckodupe: keep-line     preserve a specific line

        geckodupe: keep-section  preserve a block of lines


Img / Vid
---------

  Use this tab for folders or zips of photos and videos.

  Geckodupe compares content visually, not by filename. A resized copy,
  a renamed export, and the original can still match. Burst sequences
  (IMG_001, IMG_002, IMG_003) collapse by checking neighbors in filename
  order. Videos are sampled frame by frame and scored with perceptual
  hashes, color histograms, and timeline alignment.

  **Formats supported**

        Images                     JPG, PNG, WebP, GIF, BMP, AVIF, TIFF
                                   (HEIC where your browser can decode)

        Videos                     MP4, MOV, WebM, MKV, AVI, MPEG, and more

  **What it catches**

        Renamed copies             same shot, different filename

        Resized exports            thumbnail vs full-resolution

        Burst frames               rapid shots from the same scene

        Near-duplicate videos        re-trimmed or re-encoded clips

  **Typical workflow**

        1. Drop a folder or zip of media
        2. Set similarity (75% to 100%)
        3. Optionally pick a reference target to keep one file and remove
           only its variations
        4. Add skip paths for folders you want left alone
        5. Click Deduplicate and review kept vs removed groups

  **Reference target mode**

        Pick one photo or video as the original. Geckodupe removes files
        that look like variations of that target and leaves everything else
        in the library alone.


Requirements
------------

You need a modern browser (Chrome, Firefox, Edge, or Safari).

Node.js is only required if you want to run the local dev server or tests.




## License

  This program is free software; you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation; either version 3 of the License, or
  any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU General Public License for more details.

  You should have received a copy of the GNU General Public License
  along with this program; if not, write to the Free Software
  Foundation, Inc., 59 Temple Place, Suite 330, Boston, MA  02111-1307  USA

  See the repository for license files.

