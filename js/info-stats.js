// Geckodupe by Flareform Info Page: D3 area charts

var INFO_COLORS = {
  primary: '#F6821F',
  secondary: '#D96C10',
  primaryStroke: 'rgba(246,130,31,0.9)',
  secondaryStroke: 'rgba(217,108,16,0.85)',
  axis: 'rgba(92,90,96,0.35)',
  grid: 'rgba(92,90,96,0.10)',
  text: '#5C5A60',
  muted: 'rgba(92,90,96,0.55)'
};

var infoStatsRendered = false;

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function formatNumber(n) {
  return n.toLocaleString();
}

function formatCompactNumber(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1000) return Math.round(n / 1000).toLocaleString() + 'k';
  return formatNumber(n);
}

function getBenchmarkData() {
  return typeof BENCHMARK_DATA !== 'undefined' ? BENCHMARK_DATA : null;
}

function updateStatCopy(data) {
  var s = data.summary;
  var el;
  el = document.getElementById('stat-avg-reduction');
  if (el) el.textContent = s.avgReductionPct + '%';
  el = document.getElementById('stat-bytes-saved');
  if (el) el.textContent = formatBytes(data.savingsDemo.bytesSaved);
  el = document.getElementById('stat-savings-reduction');
  if (el) el.textContent = data.savingsDemo.reductionPct + '%';
  el = document.getElementById('stat-peak-throughput');
  if (el) el.textContent = formatCompactNumber(s.peakLinesPerSec);
  el = document.getElementById('stat-peak-at');
  if (el) el.textContent = s.peakAt;
  el = document.getElementById('stat-large-batch');
  if (el) el.textContent = formatNumber(s.largestBatchLines) + ' lines in ' + s.largestBatchMs + ' ms';
  el = document.getElementById('stat-log-reduction');
  if (el) el.textContent = s.logReductionPct + '%';
  el = document.getElementById('stat-folder-throughput');
  if (el) el.textContent = formatCompactNumber(s.folderPeakFilesPerSec);
  el = document.getElementById('stat-folder-at');
  if (el) el.textContent = s.folderPeakAt;
}

function getChartDimensions(el, margin) {
  var parent = el.closest('.info-stats-visual') || el.parentElement;
  var containerWidth = parent ? parent.clientWidth : (el.clientWidth || 320);
  var width = Math.max(containerWidth - margin.left - margin.right, 200);
  var height = 200 - margin.top - margin.bottom;
  return { width: width, height: height };
}

function appendGradients(svg) {
  var defs = svg.append('defs');
  defs.append('linearGradient').attr('id', 'area-grad-primary').attr('x1', '0').attr('y1', '0').attr('x2', '0').attr('y2', '1')
    .selectAll('stop').data([
      { offset: '0%', color: 'rgba(246,130,31,0.28)' },
      { offset: '100%', color: 'rgba(246,130,31,0.03)' }
    ]).enter().append('stop').attr('offset', function(d) { return d.offset; }).attr('stop-color', function(d) { return d.color; });
  defs.append('linearGradient').attr('id', 'area-grad-secondary').attr('x1', '0').attr('y1', '0').attr('x2', '2').attr('y2', '1')
    .selectAll('stop').data([
      { offset: '0%', color: 'rgba(217,108,16,0.22)' },
      { offset: '100%', color: 'rgba(217,108,16,0.03)' }
    ]).enter().append('stop').attr('offset', function(d) { return d.offset; }).attr('stop-color', function(d) { return d.color; });
}

function drawAxes(g, x, y, width, height, xFormat, yFormat) {
  g.append('g').attr('class', 'chart-axis chart-axis-x').attr('transform', 'translate(0,' + height + ')')
    .call(d3.axisBottom(x).ticks(5).tickSize(0).tickPadding(8).tickFormat(xFormat || null))
    .call(function(sel) { sel.select('.domain').attr('stroke', INFO_COLORS.axis); })
    .selectAll('text').attr('fill', INFO_COLORS.muted);
  g.append('g').attr('class', 'chart-axis chart-axis-y')
    .call(d3.axisLeft(y).ticks(5).tickSize(-width).tickPadding(8).tickFormat(yFormat || null))
    .call(function(sel) {
      sel.select('.domain').remove();
      sel.selectAll('.tick line').attr('stroke', INFO_COLORS.grid);
      sel.selectAll('.tick text').attr('fill', INFO_COLORS.muted);
    });
}

function drawLegend(container, items) {
  var legend = container.append('div').attr('class', 'chart-legend');
  items.forEach(function(item) {
    legend.append('div').attr('class', 'chart-legend-item')
      .html('<span class="chart-legend-swatch" style="background:' + item.color + '"></span>' + item.label);
  });
}

function renderReductionArea(rows) {
  var el = document.getElementById('chart-reduction-area');
  if (!el || typeof d3 === 'undefined') return;
  el.innerHTML = '';
  var margin = { top: 12, right: 16, bottom: 32, left: 48 };
  var dims = getChartDimensions(el, margin);
  var svg = d3.select(el).append('svg').attr('width', dims.width + margin.left + margin.right).attr('height', dims.height + margin.top + margin.bottom).attr('class', 'chart-svg');
  appendGradients(svg);
  var g = svg.append('g').attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');
  var data = rows.map(function(r) { return { lines: r.total, unique: r.remaining, removed: r.removed }; });
  var x = d3.scaleLinear().domain(d3.extent(data, function(d) { return d.lines; })).range([0, dims.width]);
  var y = d3.scaleLinear().domain([0, d3.max(data, function(d) { return d.unique + d.removed; }) * 1.05]).range([dims.height, 0]);
  drawAxes(g, x, y, dims.width, dims.height, function(d) { return d >= 1000 ? (d / 1000) + 'k' : d; }, function(d) { return d >= 1000 ? (d / 1000) + 'k' : d; });
  var series = d3.stack().keys(['unique', 'removed'])(data);
  var area = d3.area().curve(d3.curveMonotoneX).x(function(d) { return x(d.data.lines); }).y0(function(d) { return y(d[0]); }).y1(function(d) { return y(d[1]); });
  var fills = ['url(#area-grad-secondary)', 'url(#area-grad-primary)'];
  var strokes = [INFO_COLORS.secondaryStroke, INFO_COLORS.primaryStroke];
  g.selectAll('.area-layer').data(series).enter().append('path').attr('class', 'area-layer').attr('fill', function(_, i) { return fills[i]; }).attr('d', area);
  g.selectAll('.area-line').data(series).enter().append('path').attr('class', 'area-line').attr('fill', 'none').attr('stroke', function(_, i) { return strokes[i]; }).attr('stroke-width', 1.25)
    .attr('d', function(s) { return d3.line().curve(d3.curveMonotoneX).x(function(d) { return x(d.data.lines); }).y(function(d) { return y(d[1]); })(s); });
  drawLegend(d3.select(el), [
    { label: 'Unique lines', color: INFO_COLORS.secondary },
    { label: 'Duplicates removed', color: INFO_COLORS.primary }
  ]);
}

function renderThroughputArea(rows, yKey, yFormat, legendLabel) {
  var el = document.getElementById('chart-throughput');
  if (!el || typeof d3 === 'undefined') return;
  el.innerHTML = '';
  var margin = { top: 12, right: 16, bottom: 32, left: 52 };
  var dims = getChartDimensions(el, margin);
  var svg = d3.select(el).append('svg').attr('width', dims.width + margin.left + margin.right).attr('height', dims.height + margin.top + margin.bottom).attr('class', 'chart-svg');
  appendGradients(svg);
  var g = svg.append('g').attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');
  var data = rows.map(function(r) { return { x: r.total, y: r[yKey] }; });
  var x = d3.scaleLinear().domain(d3.extent(data, function(d) { return d.x; })).range([0, dims.width]);
  var y = d3.scaleLinear().domain([0, d3.max(data, function(d) { return d.y; }) * 1.15]).range([dims.height, 0]);
  drawAxes(g, x, y, dims.width, dims.height, function(d) { return d >= 1000 ? (d / 1000) + 'k' : d; }, yFormat);
  var area = d3.area().curve(d3.curveMonotoneX).x(function(d) { return x(d.x); }).y0(dims.height).y1(function(d) { return y(d.y); });
  var line = d3.line().curve(d3.curveMonotoneX).x(function(d) { return x(d.x); }).y(function(d) { return y(d.y); });
  g.append('path').datum(data).attr('class', 'area-layer').attr('fill', 'url(#area-grad-primary)').attr('d', area);
  g.append('path').datum(data).attr('class', 'area-line').attr('fill', 'none').attr('stroke', INFO_COLORS.primaryStroke).attr('stroke-width', 1.25).attr('d', line);
  g.selectAll('.area-dot').data(data).enter().append('circle').attr('cx', function(d) { return x(d.x); }).attr('cy', function(d) { return y(d.y); }).attr('r', 3).attr('fill', '#F7F7F4').attr('stroke', INFO_COLORS.primaryStroke).attr('stroke-width', 1.5);
  drawLegend(d3.select(el), [{ label: legendLabel, color: INFO_COLORS.primary }]);
}

function renderFolderArea(rows) {
  var el = document.getElementById('chart-folder');
  if (!el || typeof d3 === 'undefined') return;
  el.innerHTML = '';
  var margin = { top: 12, right: 16, bottom: 32, left: 52 };
  var dims = getChartDimensions(el, margin);
  var svg = d3.select(el).append('svg').attr('width', dims.width + margin.left + margin.right).attr('height', dims.height + margin.top + margin.bottom).attr('class', 'chart-svg');
  appendGradients(svg);
  var g = svg.append('g').attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');
  var data = rows.map(function(r) { return { files: r.total, ms: r.ms }; });
  var x = d3.scaleLinear().domain(d3.extent(data, function(d) { return d.files; })).range([0, dims.width]);
  var y = d3.scaleLinear().domain([0, d3.max(data, function(d) { return d.ms; }) * 1.2]).range([dims.height, 0]);
  drawAxes(g, x, y, dims.width, dims.height, function(d) { return d + ' files'; }, function(d) { return d + ' ms'; });
  var area = d3.area().curve(d3.curveMonotoneX).x(function(d) { return x(d.files); }).y0(dims.height).y1(function(d) { return y(d.ms); });
  var line = d3.line().curve(d3.curveMonotoneX).x(function(d) { return x(d.files); }).y(function(d) { return y(d.ms); });
  g.append('path').datum(data).attr('class', 'area-layer').attr('fill', 'url(#area-grad-secondary)').attr('d', area);
  g.append('path').datum(data).attr('class', 'area-line').attr('fill', 'none').attr('stroke', INFO_COLORS.secondaryStroke).attr('stroke-width', 1.25).attr('d', line);
  drawLegend(d3.select(el), [{ label: 'Project scan time (ms)', color: INFO_COLORS.secondary }]);
}

function renderSavingsArea(rows, savingsDemo, logDemo) {
  var el = document.getElementById('chart-savings-bars');
  if (!el || typeof d3 === 'undefined') return;
  el.innerHTML = '';
  var margin = { top: 12, right: 16, bottom: 32, left: 56 };
  var dims = getChartDimensions(el, margin);
  var svg = d3.select(el).append('svg').attr('width', dims.width + margin.left + margin.right).attr('height', dims.height + margin.top + margin.bottom).attr('class', 'chart-svg');
  appendGradients(svg);
  var g = svg.append('g').attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');
  var data = rows.map(function(r) { return { lines: r.total, original: r.bytesIn, deduped: r.bytesOut }; });
  data.push({ lines: savingsDemo.total, original: savingsDemo.bytesIn, deduped: savingsDemo.bytesOut });
  data.push({ lines: logDemo.total, original: logDemo.bytesIn, deduped: logDemo.bytesOut });
  data.sort(function(a, b) { return a.lines - b.lines; });
  var x = d3.scaleLinear().domain(d3.extent(data, function(d) { return d.lines; })).range([0, dims.width]);
  var y = d3.scaleLinear().domain([0, d3.max(data, function(d) { return d.original; }) * 1.08]).range([dims.height, 0]);
  drawAxes(g, x, y, dims.width, dims.height, function(d) { return d >= 1000 ? (d / 1000) + 'k' : d; }, function(d) { return formatBytes(d); });
  function makeArea(key) {
    return d3.area().curve(d3.curveMonotoneX).x(function(d) { return x(d.lines); }).y0(dims.height).y1(function(d) { return y(d[key]); });
  }
  g.append('path').datum(data).attr('fill', 'url(#area-grad-secondary)').attr('d', makeArea('original'));
  g.append('path').datum(data).attr('fill', 'url(#area-grad-primary)').attr('d', makeArea('deduped'));
  g.append('path').datum(data).attr('fill', 'none').attr('stroke', INFO_COLORS.secondaryStroke).attr('stroke-width', 1.25)
    .attr('d', d3.line().curve(d3.curveMonotoneX).x(function(d) { return x(d.lines); }).y(function(d) { return y(d.original); }));
  g.append('path').datum(data).attr('fill', 'none').attr('stroke', INFO_COLORS.primaryStroke).attr('stroke-width', 1.25)
    .attr('d', d3.line().curve(d3.curveMonotoneX).x(function(d) { return x(d.lines); }).y(function(d) { return y(d.deduped); }));
  drawLegend(d3.select(el), [
    { label: 'Original file size', color: INFO_COLORS.secondary },
    { label: 'After deduplication', color: INFO_COLORS.primary }
  ]);
}

function renderInfoStats() {
  if (infoStatsRendered) return;
  var data = getBenchmarkData();
  if (!data || typeof d3 === 'undefined') return;

  updateStatCopy(data);
  renderReductionArea(data.throughput);
  renderThroughputArea(data.throughput, 'linesPerSec', function(d) {
    return d >= 1000 ? formatCompactNumber(d) : d;
  }, 'Throughput (lines/sec)');
  renderFolderArea(data.folderThroughput);
  renderSavingsArea(data.throughput, data.savingsDemo, data.logDemo);
  infoStatsRendered = true;
}
