---
title: "Apple Health Pro: turning an Apple Health export into a local data pipeline"
date: 2026-11-04 15:00:00
lang: en
categories:
  - Everyday Anatomy
tags:
  - Apple
  - CSV
  - XML
description: "A local Apple Health export workflow with CSV, JSONL, source filtering, and explicit privacy and deduplication limits."
etoc: true
---

<p><a hreflang="zh-CN" href="/2026/11/04/apple-health-pro-local-export/">中文版</a></p>


An Apple Health export is a useful starting point, but a ZIP full of XML is not yet a convenient input for a spreadsheet or a script. Apple Health Pro converts that archive into categorized files on your own computer, with source and date filtering and a manifest describing the result.

This article covers the published [v8.9.1 release](https://github.com/leecdiang/Apple-Health-Pro/releases/tag/v8.9.1). The desktop app exports CSV. The standalone CLI exports CSV or JSON Lines and does not require a separate Python or Qt installation. Packages are available for macOS Apple Silicon, macOS Intel, Windows x64, and Linux x86_64.

![Apple Health Pro light interface with 217 synthetic demo records](/images/apple-health-pro-20261104/linux-offscreen-light.png)

v8.9.0 source GUI rendered offscreen on Linux with synthetic demo records. This is not a macOS desktop capture.

## Start with a small, inspectable export

The desktop workflow is straightforward: select an Apple Health ZIP, let the scan finish, choose sources and a date range, and export to a new result directory. To explore the interface without opening personal records, load the built-in synthetic demo data.

For a script-based workflow on macOS or Linux, extract the matching standalone CLI package and run:

```bash
mkdir -p output
./healthpro-cli sources --input export.zip --quiet
./healthpro-cli export --input export.zip --output ./output --format jsonl
```

The first command lists original source names. Keep that output private: source discovery deliberately exposes the names needed for exact matching. Export filtering uses those names, is case-sensitive, and can be repeated for multiple sources. An unknown source name produces an error rather than silently selecting everything.

The output directory must already exist. Each successful export creates a new result subdirectory. The CLI writes a single JSON result to stdout, while progress, warnings, and errors go to stderr. The result contains paths and counts; the health records themselves live in the output files.

A script can read the result object without stripping progress messages from it, then inspect the manifest before using the data. See the [versioned CLI documentation](https://github.com/leecdiang/Apple-Health-Pro/blob/v8.9.1/docs/cli.md) for parameters and exit codes.

## Keep the meaning of the source data visible

The export uses two-pass streaming parsing rather than retaining a complete DataFrame. It preserves original timestamps, units, and value text. Files are split by category and can be chunked, with 880,000 records per file as the default.

In JSONL, the original `value` string is the authoritative representation for precise calculations. A `numeric_value` helper makes ordinary numeric processing convenient, but floating-point conversion can round decimal values. Consumers can also lose precision with large integers. If precision matters, parse the original text into an appropriate decimal representation.

Date filtering follows each record's original-timezone `startDate` calendar day, including both endpoints. It does not normalize timestamps to UTC or divide an overnight record across multiple days. Downstream daily summaries need to account for that behavior explicitly.

The `export_manifest.json` file provides row accounting, filter information, unknown-type counts, multi-source indicators, and file hashes. It gives a consumer something concrete to check alongside the data.

## Multiple sources do not imply deduplicated totals

Apple Health Pro exports a union of raw records. It does not reproduce the Health app's source-priority rules or automatically deduplicate overlapping sources.

If two devices record the same walk, adding every exported step or distance record may count overlapping activity more than once. Before aggregating, choose an appropriate source or define and validate your own reconciliation rules. The manifest identifies metrics contributed by multiple sources, but that flag is not an automatic resolution of overlap.

Preserving a record and deciding how it contributes to a total are separate operations.

![Apple Health Pro dark interface after exporting synthetic demo records](/images/apple-health-pro-20261104/linux-offscreen-dark.png)

The same v8.9.0 synthetic demo in dark mode, rendered offscreen on Linux. These screenshots illustrate the interface, not the parsing fixes in v8.9.1.

## Local processing has a defined privacy boundary

Parsing and export happen locally. By default, source names are replaced with labels such as `Source_001`, consistent within that export job. Source-name mappings, device descriptions, and free-text metadata are not exported.

This is source-name masking, not complete de-identification. Timestamps and health values remain in the result and may still identify a person. The labels should not be treated as stable identifiers across separate exports.

Uploading the result to a cloud drive, hosted notebook, or AI service is a separate disclosure of data. Review what a file contains and how its recipient will use it before sharing. Synthetic records are preferable for demonstrations and public bug reports.

CSV exports also enable spreadsheet-safe text by default. Potential formula text is prefixed, while valid numeric values are preserved. That protection does not make an arbitrary CSV trustworthy. JSONL keeps original text and can be useful for programmatic processing.

## Know what is outside the export

v8.9.1 exports top-level Record, Workout, and StateOfMind elements. Repeated Record references inside Correlation are no longer counted or exported again, and records nested inside unknown containers are excluded. This parsing fix does not reconcile overlapping device sources. If a previously exported archive contains Correlation, re-exporting with this release is advisable. Unknown top-level Record identifiers are retained separately. Workout statistics are preserved when available. StateOfMind attributes are included, but nested labels and associations are not interpreted.

ECG and route attachments, ClinicalRecord, and free-text metadata are outside this version's output scope. Unsupported top-level elements are counted and reported. Missing end timestamps remain missing rather than being invented.

These files can support data inspection and visualization. Neither the converter nor an analysis built on its output should be treated as a medical diagnosis.

Linux downloads include .deb, AppImage, and a standalone CLI. Their availability does not mean every distribution and desktop environment has been manually tested. The offscreen captures here do not establish real-desktop file-picker, window-interaction, or display compatibility. For environments without FUSE, the release supports AppImage’s `--appimage-extract-and-run` mode; see the [release notes](https://github.com/leecdiang/Apple-Health-Pro/releases/tag/v8.9.1).

The project is [open source under MIT](https://github.com/leecdiang/Apple-Health-Pro). The release includes checksums; macOS packages currently use ad-hoc signing and are not Developer ID notarized. If you report an issue, include the version, operating system, and reproduction steps without attaching a real health archive.

