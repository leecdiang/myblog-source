---
lang: zh-CN
title: "从油门到后轮：同样的排量，几缸才适合你？"
date: 2026-11-01 14:56:00
categories: Everyday Anatomy
etoc: true
tags:
  - 摩托车
  - 发动机
  - 动力性能
  - 振动与噪声
  - 工程分析
description: "四缸马力更大，为什么不降挡超车反而慢？从真实加速测试出发，沿着发动机、变速箱和骑手接触点，看看缸数怎样改变动力、节奏与长途体验。"
mathjax: true
updated: 2026-11-02 13:46:07
toc:
  max_depth: 2
---

聊摩托车的缸数，很容易聊成两种立场：有人喜欢大单缸每一下做功的存在感，有人觉得四缸绵密、顺滑，才适合长途。

我更想弄清楚的是：同样六百多 cc，从拧动油门到车开始加速，再到手心感到振动，中间究竟发生了什么？

这几个感受常被塞进一句“这车有劲”里。可一辆车可以不降挡就轻松提速，也可以降两挡之后才显出本事；可以节奏鲜明，却没有更大的平均推力。先看一组实测，这些差别就具体了。

<!-- more -->

<span id="1-实车对比：拉转加速最快，最高挡超车却最慢"></span>

## 1. 四缸更快，为什么超车却更慢？

Dueruote 在2021年把 Yamaha MT-07、Triumph Trident 660 和 Honda CB650R 放在一起测试。它们分别是双缸、三缸和四缸，排量都在650 cc上下。<sup class="cite"><a href="#ref-1">1</a></sup>

从静止加速到130 km/h，CB650R 用了5.9秒，三车最快。可换成**最高挡、不降挡，从80加到130 km/h**，它用了8.4秒，反而最慢。Trident 的这项成绩是6.7秒。

<div class="v-figure v-chart-scroll">
<p class="v-scroll-hint">横向滑动查看完整图表</p>
<div class="v-chart-viewport" tabindex="0" role="region" aria-label="同一批样车，两种加速任务">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 717.612406 209.717781" version="1.1" role="img" aria-labelledby="01-road-title 01-road-desc" stroke-linejoin="round" stroke-linecap="butt">
 <title id="01-road-title">同一批样车，两种加速任务</title><desc id="01-road-desc">2021 Dueruote测试。MT-07、Trident 660、CB650R的0至130用时分别为7.3、7.1、5.9秒；最高挡80至130分别为7.2、6.7、8.4秒。</desc><defs>
  </defs>
 <g id="01-road-figure_1">
  <g id="01-road-patch_1">
   <path d="M 0 209.717781  L 717.612406 209.717781  L 717.612406 0  L 0 0  L 0 209.717781  z " fill="none" />
  </g>
  <g id="01-road-axes_1">
   <g id="01-road-patch_2">
    <path d="M 70.839375 168.937156  L 311.69717 168.937156  L 311.69717 33.505156  L 70.839375 33.505156  L 70.839375 168.937156  z " fill="none" />
   </g>
   <g id="01-road-matplotlib.axis_1">
    <g id="01-road-xtick_1">
     <g id="01-road-line2d_1">
      <path d="M 70.839375 168.937156  L 70.839375 33.505156  " clip-path="url(#01-road-pd573aa4e6a)" fill="none" stroke="var(--divider)" stroke-width="0.7" stroke-linecap="square" />
     </g>
     <g id="01-road-line2d_2" />
     <g id="01-road-text_1">
      <text x="70.839375" y="184.81075" transform="rotate(-0 70.839375 184.81075)" fill="var(--text-secondary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="middle">0</text>
     </g>
    </g>
    <g id="01-road-xtick_2">
     <g id="01-road-line2d_3">
      <path d="M 119.010934 168.937156  L 119.010934 33.505156  " clip-path="url(#01-road-pd573aa4e6a)" fill="none" stroke="var(--divider)" stroke-width="0.7" stroke-linecap="square" />
     </g>
     <g id="01-road-line2d_4" />
     <g id="01-road-text_2">
      <text x="119.010934" y="184.81075" transform="rotate(-0 119.010934 184.81075)" fill="var(--text-secondary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="middle">2</text>
     </g>
    </g>
    <g id="01-road-xtick_3">
     <g id="01-road-line2d_5">
      <path d="M 167.182493 168.937156  L 167.182493 33.505156  " clip-path="url(#01-road-pd573aa4e6a)" fill="none" stroke="var(--divider)" stroke-width="0.7" stroke-linecap="square" />
     </g>
     <g id="01-road-line2d_6" />
     <g id="01-road-text_3">
      <text x="167.182493" y="184.81075" transform="rotate(-0 167.182493 184.81075)" fill="var(--text-secondary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="middle">4</text>
     </g>
    </g>
    <g id="01-road-xtick_4">
     <g id="01-road-line2d_7">
      <path d="M 215.354052 168.937156  L 215.354052 33.505156  " clip-path="url(#01-road-pd573aa4e6a)" fill="none" stroke="var(--divider)" stroke-width="0.7" stroke-linecap="square" />
     </g>
     <g id="01-road-line2d_8" />
     <g id="01-road-text_4">
      <text x="215.354052" y="184.81075" transform="rotate(-0 215.354052 184.81075)" fill="var(--text-secondary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="middle">6</text>
     </g>
    </g>
    <g id="01-road-xtick_5">
     <g id="01-road-line2d_9">
      <path d="M 263.525611 168.937156  L 263.525611 33.505156  " clip-path="url(#01-road-pd573aa4e6a)" fill="none" stroke="var(--divider)" stroke-width="0.7" stroke-linecap="square" />
     </g>
     <g id="01-road-line2d_10" />
     <g id="01-road-text_5">
      <text x="263.525611" y="184.81075" transform="rotate(-0 263.525611 184.81075)" fill="var(--text-secondary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="middle">8</text>
     </g>
    </g>
    <g id="01-road-xtick_6">
     <g id="01-road-line2d_11">
      <path d="M 311.69717 168.937156  L 311.69717 33.505156  " clip-path="url(#01-road-pd573aa4e6a)" fill="none" stroke="var(--divider)" stroke-width="0.7" stroke-linecap="square" />
     </g>
     <g id="01-road-line2d_12" />
     <g id="01-road-text_6">
      <text x="311.69717" y="184.81075" transform="rotate(-0 311.69717 184.81075)" fill="var(--text-secondary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="middle">10</text>
     </g>
    </g>
    <g id="01-road-text_7">
     <text x="191.268272" y="200.207781" transform="rotate(-0 191.268272 200.207781)" fill="var(--text-secondary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="middle">用时（s），越短越快</text>
    </g>
   </g>
   <g id="01-road-matplotlib.axis_2">
    <g id="01-road-ytick_1">
     <g id="01-road-line2d_13" />
     <g id="01-road-text_8">
      <text x="62.839375" y="55.109173" transform="rotate(-0 62.839375 55.109173)" fill="var(--text-primary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="end">MT-07</text>
     </g>
    </g>
    <g id="01-road-ytick_2">
     <g id="01-road-line2d_14" />
     <g id="01-road-text_9">
      <text x="62.839375" y="105.157953" transform="rotate(-0 62.839375 105.157953)" fill="var(--text-primary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="end">Trident 660</text>
     </g>
    </g>
    <g id="01-road-ytick_3">
     <g id="01-road-line2d_15" />
     <g id="01-road-text_10">
      <text x="62.839375" y="155.206734" transform="rotate(-0 62.839375 155.206734)" fill="var(--text-primary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="end">CB650R</text>
     </g>
    </g>
   </g>
   <g id="01-road-patch_3">
    <path d="M 70.839375 39.661156  L 246.665565 39.661156  L 246.665565 62.683595  L 70.839375 62.683595  z " clip-path="url(#01-road-pd573aa4e6a)" fill="var(--accent)" />
   </g>
   <g id="01-road-patch_4">
    <path d="M 70.839375 89.709937  L 241.848409 89.709937  L 241.848409 112.732376  L 70.839375 112.732376  z " clip-path="url(#01-road-pd573aa4e6a)" fill="var(--accent)" />
   </g>
   <g id="01-road-patch_5">
    <path d="M 70.839375 139.758717  L 212.945474 139.758717  L 212.945474 162.781156  L 70.839375 162.781156  z " clip-path="url(#01-road-pd573aa4e6a)" fill="var(--accent)" />
   </g>
   <g id="01-road-text_11">
    <text x="250.037574" y="54.01347" transform="rotate(-0 250.037574 54.01347)" fill="var(--text-primary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="start">7.3</text>
   </g>
   <g id="01-road-text_12">
    <text x="245.220418" y="104.06225" transform="rotate(-0 245.220418 104.06225)" fill="var(--text-primary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="start">7.1</text>
   </g>
   <g id="01-road-text_13">
    <text x="216.317483" y="154.11103" transform="rotate(-0 216.317483 154.11103)" fill="var(--text-primary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="start">5.9</text>
   </g>
   <g id="01-road-text_14">
    <text x="70.839375" y="16.505156" transform="rotate(-0 70.839375 16.505156)" fill="var(--text-primary)" font-size="13" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="start">起步加速：0–130 km/h</text>
   </g>
  </g>
  <g id="01-road-axes_2">
   <g id="01-road-patch_6">
    <path d="M 463.43758 168.937156  L 704.295375 168.937156  L 704.295375 33.505156  L 463.43758 33.505156  L 463.43758 168.937156  z " fill="none" />
   </g>
   <g id="01-road-matplotlib.axis_3">
    <g id="01-road-xtick_7">
     <g id="01-road-line2d_16">
      <path d="M 463.43758 168.937156  L 463.43758 33.505156  " clip-path="url(#01-road-p593160ba62)" fill="none" stroke="var(--divider)" stroke-width="0.7" stroke-linecap="square" />
     </g>
     <g id="01-road-line2d_17" />
     <g id="01-road-text_15">
      <text x="463.43758" y="184.81075" transform="rotate(-0 463.43758 184.81075)" fill="var(--text-secondary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="middle">0</text>
     </g>
    </g>
    <g id="01-road-xtick_8">
     <g id="01-road-line2d_18">
      <path d="M 511.609139 168.937156  L 511.609139 33.505156  " clip-path="url(#01-road-p593160ba62)" fill="none" stroke="var(--divider)" stroke-width="0.7" stroke-linecap="square" />
     </g>
     <g id="01-road-line2d_19" />
     <g id="01-road-text_16">
      <text x="511.609139" y="184.81075" transform="rotate(-0 511.609139 184.81075)" fill="var(--text-secondary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="middle">2</text>
     </g>
    </g>
    <g id="01-road-xtick_9">
     <g id="01-road-line2d_20">
      <path d="M 559.780698 168.937156  L 559.780698 33.505156  " clip-path="url(#01-road-p593160ba62)" fill="none" stroke="var(--divider)" stroke-width="0.7" stroke-linecap="square" />
     </g>
     <g id="01-road-line2d_21" />
     <g id="01-road-text_17">
      <text x="559.780698" y="184.81075" transform="rotate(-0 559.780698 184.81075)" fill="var(--text-secondary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="middle">4</text>
     </g>
    </g>
    <g id="01-road-xtick_10">
     <g id="01-road-line2d_22">
      <path d="M 607.952257 168.937156  L 607.952257 33.505156  " clip-path="url(#01-road-p593160ba62)" fill="none" stroke="var(--divider)" stroke-width="0.7" stroke-linecap="square" />
     </g>
     <g id="01-road-line2d_23" />
     <g id="01-road-text_18">
      <text x="607.952257" y="184.81075" transform="rotate(-0 607.952257 184.81075)" fill="var(--text-secondary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="middle">6</text>
     </g>
    </g>
    <g id="01-road-xtick_11">
     <g id="01-road-line2d_24">
      <path d="M 656.123816 168.937156  L 656.123816 33.505156  " clip-path="url(#01-road-p593160ba62)" fill="none" stroke="var(--divider)" stroke-width="0.7" stroke-linecap="square" />
     </g>
     <g id="01-road-line2d_25" />
     <g id="01-road-text_19">
      <text x="656.123816" y="184.81075" transform="rotate(-0 656.123816 184.81075)" fill="var(--text-secondary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="middle">8</text>
     </g>
    </g>
    <g id="01-road-xtick_12">
     <g id="01-road-line2d_26">
      <path d="M 704.295375 168.937156  L 704.295375 33.505156  " clip-path="url(#01-road-p593160ba62)" fill="none" stroke="var(--divider)" stroke-width="0.7" stroke-linecap="square" />
     </g>
     <g id="01-road-line2d_27" />
     <g id="01-road-text_20">
      <text x="704.295375" y="184.81075" transform="rotate(-0 704.295375 184.81075)" fill="var(--text-secondary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="middle">10</text>
     </g>
    </g>
    <g id="01-road-text_21">
     <text x="583.866478" y="200.207781" transform="rotate(-0 583.866478 200.207781)" fill="var(--text-secondary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="middle">用时（s），越短越快</text>
    </g>
   </g>
   <g id="01-road-matplotlib.axis_4">
    <g id="01-road-ytick_4">
     <g id="01-road-line2d_28" />
     <g id="01-road-text_22">
      <text x="455.43758" y="55.109173" transform="rotate(-0 455.43758 55.109173)" fill="var(--text-primary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="end">MT-07</text>
     </g>
    </g>
    <g id="01-road-ytick_5">
     <g id="01-road-line2d_29" />
     <g id="01-road-text_23">
      <text x="455.43758" y="105.157953" transform="rotate(-0 455.43758 105.157953)" fill="var(--text-primary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="end">Trident 660</text>
     </g>
    </g>
    <g id="01-road-ytick_6">
     <g id="01-road-line2d_30" />
     <g id="01-road-text_24">
      <text x="455.43758" y="155.206734" transform="rotate(-0 455.43758 155.206734)" fill="var(--text-primary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="end">CB650R</text>
     </g>
    </g>
   </g>
   <g id="01-road-patch_7">
    <path d="M 463.43758 39.661156  L 636.855192 39.661156  L 636.855192 62.683595  L 463.43758 62.683595  z " clip-path="url(#01-road-p593160ba62)" fill="var(--chart-teal)" />
   </g>
   <g id="01-road-patch_8">
    <path d="M 463.43758 89.709937  L 624.812303 89.709937  L 624.812303 112.732376  L 463.43758 112.732376  z " clip-path="url(#01-road-p593160ba62)" fill="var(--chart-teal)" />
   </g>
   <g id="01-road-patch_9">
    <path d="M 463.43758 139.758717  L 665.758128 139.758717  L 665.758128 162.781156  L 463.43758 162.781156  z " clip-path="url(#01-road-p593160ba62)" fill="var(--chart-teal)" />
   </g>
   <g id="01-road-text_25">
    <text x="640.227202" y="54.01347" transform="rotate(-0 640.227202 54.01347)" fill="var(--text-primary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="start">7.2</text>
   </g>
   <g id="01-road-text_26">
    <text x="628.184312" y="104.06225" transform="rotate(-0 628.184312 104.06225)" fill="var(--text-primary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="start">6.7</text>
   </g>
   <g id="01-road-text_27">
    <text x="669.130137" y="154.11103" transform="rotate(-0 669.130137 154.11103)" fill="var(--text-primary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="start">8.4</text>
   </g>
   <g id="01-road-text_28">
    <text x="463.43758" y="16.505156" transform="rotate(-0 463.43758 16.505156)" fill="var(--text-primary)" font-size="13" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="start">最高挡再加速：80–130 km/h</text>
   </g>
  </g>
 </g>
 <defs>
  <clipPath id="01-road-pd573aa4e6a">
   <rect x="70.839375" y="33.505156" width="240.857795" height="135.432" />
  </clipPath>
  <clipPath id="01-road-p593160ba62">
   <rect x="463.43758" y="33.505156" width="240.857795" height="135.432" />
  </clipPath>
 </defs>
</svg>
</div>
<p class="v-caption">图1｜道路实测。两图均从0秒起、使用相同刻度，测试任务不同。四缸 CB650R 在左图最快，在右图最慢。来源 <a href="#ref-1">[1]</a>；无逐次记录可供估计置信区间。</p>
</div>

这并不矛盾。起步加速时，骑手可以不断升挡，让发动机待在擅长的转速区间；最高挡超车，则要看此刻这个挡位能给出多少推力。

所以，单说“加速更快”还差半句话：是愿意降挡、拉转，还是希望手腕一动，车就跟着走？

<div class="note primary"><p><i class="fa-solid fa-gauge-high" aria-hidden="true"></i> <strong>先记住这个区别：</strong>最高挡再加速反映少换挡时的便利；允许换挡的加速，反映能调用多少性能。两种需求都很实际。</p></div>

要解释这组成绩，先看发动机给变速箱送来了什么。

<span id="2-同排量下，平均扭矩为什么常常接近？"></span>

## 2. 排量相近，扭矩为什么也常常相近？

把四款2024年车型的厂商参数放到一起，会看到一个挺有意思的结果：从单缸698 Mono 到四缸 CB650R，最大扭矩都在63–67 N·m之间，最大功率却从54跨到了70 kW。<sup class="cite"><a href="#ref-2">2</a>,<a href="#ref-3">3</a>,<a href="#ref-4">4</a>,<a href="#ref-5">5</a></sup>

<div class="v-figure v-chart-scroll">
<p class="v-scroll-hint">横向滑动查看完整图表</p>
<div class="v-chart-viewport" tabindex="0" role="region" aria-label="扭矩相近，峰值功率仍有差距">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 707.252219 240.971156" version="1.1" role="img" aria-labelledby="02-engine-peaks-title 02-engine-peaks-desc" stroke-linejoin="round" stroke-linecap="butt">
 <title id="02-engine-peaks-title">扭矩相近，峰值功率仍有差距</title><desc id="02-engine-peaks-desc">2024厂商参数：698 Mono、MT-07、Trident 660、CB650R，峰值扭矩依次63、67、64、63牛米，峰值功率57、54、60、70千瓦。两列单位不同。</desc><defs>
  </defs>
 <g id="02-engine-peaks-figure_1">
  <g id="02-engine-peaks-patch_1">
   <path d="M 0 240.971156  L 707.252219 240.971156  L 707.252219 0  L 0 0  L 0 240.971156  z " fill="none" />
  </g>
  <g id="02-engine-peaks-axes_1">
   <g id="02-engine-peaks-patch_2">
    <path d="M 97.124219 215.706156  L 305.030426 215.706156  L 305.030426 35.130156  L 97.124219 35.130156  L 97.124219 215.706156  z " fill="none" />
   </g>
   <g id="02-engine-peaks-matplotlib.axis_1">
    <g id="02-engine-peaks-xtick_1">
     <g id="02-engine-peaks-line2d_1">
      <path d="M 97.124219 215.706156  L 97.124219 35.130156  " clip-path="url(#02-engine-peaks-p73820a7913)" fill="none" stroke="var(--divider)" stroke-width="0.7" stroke-linecap="square" />
     </g>
     <g id="02-engine-peaks-line2d_2" />
     <g id="02-engine-peaks-text_1">
      <text x="97.124219" y="231.57975" transform="rotate(-0 97.124219 231.57975)" fill="var(--text-secondary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="middle">0</text>
     </g>
    </g>
    <g id="02-engine-peaks-xtick_2">
     <g id="02-engine-peaks-line2d_3">
      <path d="M 149.10077 215.706156  L 149.10077 35.130156  " clip-path="url(#02-engine-peaks-p73820a7913)" fill="none" stroke="var(--divider)" stroke-width="0.7" stroke-linecap="square" />
     </g>
     <g id="02-engine-peaks-line2d_4" />
     <g id="02-engine-peaks-text_2">
      <text x="149.10077" y="231.57975" transform="rotate(-0 149.10077 231.57975)" fill="var(--text-secondary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="middle">20</text>
     </g>
    </g>
    <g id="02-engine-peaks-xtick_3">
     <g id="02-engine-peaks-line2d_5">
      <path d="M 201.077322 215.706156  L 201.077322 35.130156  " clip-path="url(#02-engine-peaks-p73820a7913)" fill="none" stroke="var(--divider)" stroke-width="0.7" stroke-linecap="square" />
     </g>
     <g id="02-engine-peaks-line2d_6" />
     <g id="02-engine-peaks-text_3">
      <text x="201.077322" y="231.57975" transform="rotate(-0 201.077322 231.57975)" fill="var(--text-secondary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="middle">40</text>
     </g>
    </g>
    <g id="02-engine-peaks-xtick_4">
     <g id="02-engine-peaks-line2d_7">
      <path d="M 253.053874 215.706156  L 253.053874 35.130156  " clip-path="url(#02-engine-peaks-p73820a7913)" fill="none" stroke="var(--divider)" stroke-width="0.7" stroke-linecap="square" />
     </g>
     <g id="02-engine-peaks-line2d_8" />
     <g id="02-engine-peaks-text_4">
      <text x="253.053874" y="231.57975" transform="rotate(-0 253.053874 231.57975)" fill="var(--text-secondary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="middle">60</text>
     </g>
    </g>
    <g id="02-engine-peaks-xtick_5">
     <g id="02-engine-peaks-line2d_9">
      <path d="M 305.030426 215.706156  L 305.030426 35.130156  " clip-path="url(#02-engine-peaks-p73820a7913)" fill="none" stroke="var(--divider)" stroke-width="0.7" stroke-linecap="square" />
     </g>
     <g id="02-engine-peaks-line2d_10" />
     <g id="02-engine-peaks-text_5">
      <text x="305.030426" y="231.57975" transform="rotate(-0 305.030426 231.57975)" fill="var(--text-secondary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="middle">80</text>
     </g>
    </g>
   </g>
   <g id="02-engine-peaks-matplotlib.axis_2">
    <g id="02-engine-peaks-ytick_1">
     <g id="02-engine-peaks-line2d_11" />
     <g id="02-engine-peaks-text_6">
      <text x="89.124219" y="58.187323" transform="rotate(-0 89.124219 58.187323)" fill="var(--text-primary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="end">698 Mono · 1缸</text>
     </g>
    </g>
    <g id="02-engine-peaks-ytick_2">
     <g id="02-engine-peaks-line2d_12" />
     <g id="02-engine-peaks-text_7">
      <text x="89.124219" y="105.63241" transform="rotate(-0 89.124219 105.63241)" fill="var(--text-primary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="end">MT-07 · 2缸</text>
     </g>
    </g>
    <g id="02-engine-peaks-ytick_3">
     <g id="02-engine-peaks-line2d_13" />
     <g id="02-engine-peaks-text_8">
      <text x="89.124219" y="153.077496" transform="rotate(-0 89.124219 153.077496)" fill="var(--text-primary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="end">Trident 660 · 3缸</text>
     </g>
    </g>
    <g id="02-engine-peaks-ytick_4">
     <g id="02-engine-peaks-line2d_14" />
     <g id="02-engine-peaks-text_9">
      <text x="89.124219" y="200.522583" transform="rotate(-0 89.124219 200.522583)" fill="var(--text-primary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="end">CB650R · 4缸</text>
     </g>
    </g>
   </g>
   <g id="02-engine-peaks-patch_3">
    <path d="M 97.124219 43.338156  L 260.850357 43.338156  L 260.850357 65.162896  L 97.124219 65.162896  z " clip-path="url(#02-engine-peaks-p73820a7913)" fill="var(--accent)" />
   </g>
   <g id="02-engine-peaks-patch_4">
    <path d="M 97.124219 90.783243  L 271.245667 90.783243  L 271.245667 112.607983  L 97.124219 112.607983  z " clip-path="url(#02-engine-peaks-p73820a7913)" fill="var(--chart-teal)" />
   </g>
   <g id="02-engine-peaks-patch_5">
    <path d="M 97.124219 138.22833  L 263.449184 138.22833  L 263.449184 160.05307  L 97.124219 160.05307  z " clip-path="url(#02-engine-peaks-p73820a7913)" fill="var(--chart-amber)" />
   </g>
   <g id="02-engine-peaks-patch_6">
    <path d="M 97.124219 185.673416  L 260.850357 185.673416  L 260.850357 207.498156  L 97.124219 207.498156  z " clip-path="url(#02-engine-peaks-p73820a7913)" fill="var(--text-primary)" />
   </g>
   <g id="02-engine-peaks-text_10">
    <text x="263.449184" y="57.09162" transform="rotate(-0 263.449184 57.09162)" fill="var(--text-primary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="start">63</text>
   </g>
   <g id="02-engine-peaks-text_11">
    <text x="273.844495" y="104.536707" transform="rotate(-0 273.844495 104.536707)" fill="var(--text-primary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="start">67</text>
   </g>
   <g id="02-engine-peaks-text_12">
    <text x="266.048012" y="151.981793" transform="rotate(-0 266.048012 151.981793)" fill="var(--text-primary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="start">64</text>
   </g>
   <g id="02-engine-peaks-text_13">
    <text x="263.449184" y="199.42688" transform="rotate(-0 263.449184 199.42688)" fill="var(--text-primary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="start">63</text>
   </g>
   <g id="02-engine-peaks-text_14">
    <text x="97.124219" y="18.130156" transform="rotate(-0 97.124219 18.130156)" fill="var(--text-primary)" font-size="13" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="start">峰值扭矩（N·m）</text>
   </g>
  </g>
  <g id="02-engine-peaks-axes_2">
   <g id="02-engine-peaks-patch_7">
    <path d="M 492.146012 215.706156  L 700.052219 215.706156  L 700.052219 35.130156  L 492.146012 35.130156  L 492.146012 215.706156  z " fill="none" />
   </g>
   <g id="02-engine-peaks-matplotlib.axis_3">
    <g id="02-engine-peaks-xtick_6">
     <g id="02-engine-peaks-line2d_15">
      <path d="M 492.146012 215.706156  L 492.146012 35.130156  " clip-path="url(#02-engine-peaks-pe9d449005c)" fill="none" stroke="var(--divider)" stroke-width="0.7" stroke-linecap="square" />
     </g>
     <g id="02-engine-peaks-line2d_16" />
     <g id="02-engine-peaks-text_15">
      <text x="492.146012" y="231.57975" transform="rotate(-0 492.146012 231.57975)" fill="var(--text-secondary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="middle">0</text>
     </g>
    </g>
    <g id="02-engine-peaks-xtick_7">
     <g id="02-engine-peaks-line2d_17">
      <path d="M 541.065119 215.706156  L 541.065119 35.130156  " clip-path="url(#02-engine-peaks-pe9d449005c)" fill="none" stroke="var(--divider)" stroke-width="0.7" stroke-linecap="square" />
     </g>
     <g id="02-engine-peaks-line2d_18" />
     <g id="02-engine-peaks-text_16">
      <text x="541.065119" y="231.57975" transform="rotate(-0 541.065119 231.57975)" fill="var(--text-secondary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="middle">20</text>
     </g>
    </g>
    <g id="02-engine-peaks-xtick_8">
     <g id="02-engine-peaks-line2d_19">
      <path d="M 589.984227 215.706156  L 589.984227 35.130156  " clip-path="url(#02-engine-peaks-pe9d449005c)" fill="none" stroke="var(--divider)" stroke-width="0.7" stroke-linecap="square" />
     </g>
     <g id="02-engine-peaks-line2d_20" />
     <g id="02-engine-peaks-text_17">
      <text x="589.984227" y="231.57975" transform="rotate(-0 589.984227 231.57975)" fill="var(--text-secondary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="middle">40</text>
     </g>
    </g>
    <g id="02-engine-peaks-xtick_9">
     <g id="02-engine-peaks-line2d_21">
      <path d="M 638.903334 215.706156  L 638.903334 35.130156  " clip-path="url(#02-engine-peaks-pe9d449005c)" fill="none" stroke="var(--divider)" stroke-width="0.7" stroke-linecap="square" />
     </g>
     <g id="02-engine-peaks-line2d_22" />
     <g id="02-engine-peaks-text_18">
      <text x="638.903334" y="231.57975" transform="rotate(-0 638.903334 231.57975)" fill="var(--text-secondary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="middle">60</text>
     </g>
    </g>
    <g id="02-engine-peaks-xtick_10">
     <g id="02-engine-peaks-line2d_23">
      <path d="M 687.822442 215.706156  L 687.822442 35.130156  " clip-path="url(#02-engine-peaks-pe9d449005c)" fill="none" stroke="var(--divider)" stroke-width="0.7" stroke-linecap="square" />
     </g>
     <g id="02-engine-peaks-line2d_24" />
     <g id="02-engine-peaks-text_19">
      <text x="687.822442" y="231.57975" transform="rotate(-0 687.822442 231.57975)" fill="var(--text-secondary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="middle">80</text>
     </g>
    </g>
   </g>
   <g id="02-engine-peaks-matplotlib.axis_4">
    <g id="02-engine-peaks-ytick_5">
     <g id="02-engine-peaks-line2d_25" />
     <g id="02-engine-peaks-text_20">
      <text x="484.146012" y="58.187323" transform="rotate(-0 484.146012 58.187323)" fill="var(--text-primary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="end">698 Mono · 1缸</text>
     </g>
    </g>
    <g id="02-engine-peaks-ytick_6">
     <g id="02-engine-peaks-line2d_26" />
     <g id="02-engine-peaks-text_21">
      <text x="484.146012" y="105.63241" transform="rotate(-0 484.146012 105.63241)" fill="var(--text-primary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="end">MT-07 · 2缸</text>
     </g>
    </g>
    <g id="02-engine-peaks-ytick_7">
     <g id="02-engine-peaks-line2d_27" />
     <g id="02-engine-peaks-text_22">
      <text x="484.146012" y="153.077496" transform="rotate(-0 484.146012 153.077496)" fill="var(--text-primary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="end">Trident 660 · 3缸</text>
     </g>
    </g>
    <g id="02-engine-peaks-ytick_8">
     <g id="02-engine-peaks-line2d_28" />
     <g id="02-engine-peaks-text_23">
      <text x="484.146012" y="200.522583" transform="rotate(-0 484.146012 200.522583)" fill="var(--text-primary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="end">CB650R · 4缸</text>
     </g>
    </g>
   </g>
   <g id="02-engine-peaks-patch_8">
    <path d="M 492.146012 43.338156  L 631.565468 43.338156  L 631.565468 65.162896  L 492.146012 65.162896  z " clip-path="url(#02-engine-peaks-pe9d449005c)" fill="var(--accent)" />
   </g>
   <g id="02-engine-peaks-patch_9">
    <path d="M 492.146012 90.783243  L 624.227602 90.783243  L 624.227602 112.607983  L 492.146012 112.607983  z " clip-path="url(#02-engine-peaks-pe9d449005c)" fill="var(--chart-teal)" />
   </g>
   <g id="02-engine-peaks-patch_10">
    <path d="M 492.146012 138.22833  L 638.903334 138.22833  L 638.903334 160.05307  L 492.146012 160.05307  z " clip-path="url(#02-engine-peaks-pe9d449005c)" fill="var(--chart-amber)" />
   </g>
   <g id="02-engine-peaks-patch_11">
    <path d="M 492.146012 185.673416  L 663.362888 185.673416  L 663.362888 207.498156  L 492.146012 207.498156  z " clip-path="url(#02-engine-peaks-pe9d449005c)" fill="var(--text-primary)" />
   </g>
   <g id="02-engine-peaks-text_24">
    <text x="634.011424" y="57.09162" transform="rotate(-0 634.011424 57.09162)" fill="var(--text-primary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="start">57</text>
   </g>
   <g id="02-engine-peaks-text_25">
    <text x="626.673557" y="104.536707" transform="rotate(-0 626.673557 104.536707)" fill="var(--text-primary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="start">54</text>
   </g>
   <g id="02-engine-peaks-text_26">
    <text x="641.34929" y="151.981793" transform="rotate(-0 641.34929 151.981793)" fill="var(--text-primary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="start">60</text>
   </g>
   <g id="02-engine-peaks-text_27">
    <text x="665.808843" y="199.42688" transform="rotate(-0 665.808843 199.42688)" fill="var(--text-primary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="start">70</text>
   </g>
   <g id="02-engine-peaks-text_28">
    <text x="492.146012" y="18.130156" transform="rotate(-0 492.146012 18.130156)" fill="var(--text-primary)" font-size="13" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="start">峰值功率（kW）</text>
   </g>
  </g>
 </g>
 <defs>
  <clipPath id="02-engine-peaks-p73820a7913">
   <rect x="97.124219" y="35.130156" width="207.906207" height="180.576" />
  </clipPath>
  <clipPath id="02-engine-peaks-pe9d449005c">
   <rect x="492.146012" y="35.130156" width="207.906207" height="180.576" />
  </clipPath>
 </defs>
</svg>
</div>
<p class="v-caption">图2｜厂商参数，2024年全功率版。左右两图单位不同；63–67 N·m 是各车在各自转速的峰值，不代表同转速输出相同。来源 <a href="#ref-2">[2]</a>–<a href="#ref-5">[5]</a>。</p>
</div>

单缸把排量集中在一个气缸里，一次做功的份额大；多缸把总排量分开，每次份额小，但两圈曲轴转下来，做功次数更多。

对于四冲程发动机，如果总排量相同、每个工作循环从单位排量得到的有效功也相同，平均扭矩就相同。工程上用“制动平均有效压力”，简称 BMEP，衡量后一个条件。上面四台发动机在各自扭矩峰值处的 BMEP 约为12.0–12.2 bar，确实很接近。<sup class="cite"><a href="#ref-6">6</a></sup>

不过，63 N·m 出现在8,000 rpm，和67 N·m 出现在6,500 rpm，是两回事。图里的数值都是各自的最高点；想知道平时三四千转谁更有力，还得看那个转速下的输出。

那功率差距是怎么来的？先把它理解为：**发动机每秒能做多少功。** 扭矩相同时，转得越快，每秒完成的做功次数越多，功率也就越大：

{% raw %}<div>$$
P\;(\mathrm{kW})=\frac{2\pi n\;(\mathrm{rpm})\,T\;(\mathrm{N\,m})}{60000}
$$</div>{% endraw %}

这组车在最大功率转速下的扭矩，算出来仍都在约56–59 N·m。真正拉开差距的，是谁能把这份扭矩保持到更高转速：MT-07 的功率峰值在8,750 rpm，CB650R 在12,000 rpm。

但高转速不是车速。发动机每分钟多转的那些圈，怎样变成路上更快的加速？中间还隔着变速箱。

<span id="6-齿比怎样把高转功率变成推力？"></span>

## 3. 变速箱，把转速换成轮胎上的推力

低挡让发动机在同一车速下转得更快，也把发动机扭矩放大得更多。骑手降挡时，同时改变了这两件事。

用一个简单算例就能看清。假设在同一车速、相同轮胎和传动效率下，有两种发动机与挡位组合：

| 工作状态 | 发动机转速 | 发动机扭矩 | 总减速比，相对值 |
| --- | ---: | ---: | ---: |
| A | 6,000 rpm | 60 N·m | 1.0 |
| B | 9,000 rpm | 55 N·m | 1.5 |

B 的发动机扭矩少了8.3%，但乘上齿比后，轮胎推力却多了37.5%：$55\times1.5/60=1.375$。对应的功率是37.7与51.8 kW。这里是解释传动关系的假想算例，不对应某辆实车。<sup class="cite"><a href="#ref-6">6</a></sup>

这也解释了开头的 CB650R：愿意降挡、让它进入高转区，就能调用更大的功率；留在最高挡时，那份高转功率还没有派上用场。

换挡后转速会掉下来，因此追求加速时，最佳换挡点也未必就在最大扭矩转速。需要比较的是同一车速下，继续留在当前挡与换到下一挡，哪一个给后轮的推力更大。

实际骑起来，还有重量、风阻、轮胎附着和抬头限制。功率能解释推力从哪里来，却不能单独给出加速成绩。完整关系和这个算例的条件放在附录。

可多几个气缸，为什么往往更容易把转速做高？

<span id="3-同为399-cc，双缸与四缸差在哪里？"></span>
<span id="4-多缸为什么更容易做高转发动机？单缸又能走多远？"></span>

## 4. 多缸多出来的，常常是高转的余地

同样的总排量分给更多气缸，每个气缸可以更小。设计者因此更容易采用较短的行程，让活塞每转一圈少跑一点距离。

Ninja 400 和 ZX-4RR 是个直观的例子。两台发动机都标为399 cc，前者双缸、后者四缸。这里固定采用2023年欧规 Ninja 400 和2024年欧规 ZX-4RR，避免把不同市场的限功率版本混进来。<sup class="cite"><a href="#ref-7">7</a>,<a href="#ref-8">8</a></sup>

| 厂商参数 | Ninja 400，双缸 | ZX-4RR，四缸 |
| --- | ---: | ---: |
| 缸径 × 行程 | 70 × 51.8 mm | 57 × 39.1 mm |
| 峰值扭矩 | 37 N·m @ 8,000 rpm | 39 N·m @ 13,000 rpm |
| 峰值功率 | 33.4 kW @ 10,000 rpm | 57 kW @ 14,500 rpm |

ZX-4RR 的最大扭矩只多5.4%，最大功率却多70.7%。它的行程更短，功率峰值转速高了45%，该转速下的平均活塞速度只高约9.4%。

<div class="v-figure v-chart-scroll">
<p class="v-scroll-hint">横向滑动查看完整图表</p>
<div class="v-chart-viewport" tabindex="0" role="region" aria-label="399 cc双缸与四缸：差距集中在哪里">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 675.055532 247.612375" version="1.1" role="img" aria-labelledby="03-399cc-title 03-399cc-desc" stroke-linejoin="round" stroke-linecap="butt">
 <title id="03-399cc-title">399 cc双缸与四缸：差距集中在哪里</title><desc id="03-399cc-desc">Ninja 400作为100基准，ZX-4RR的功率170.7，功率峰值转速145，峰值扭矩105.4，平均活塞速度109.4，整备质量112.5。</desc><defs>
  </defs>
 <g id="03-399cc-figure_1">
  <g id="03-399cc-patch_1">
   <path d="M 0 247.612375  L 675.055532 247.612375  L 675.055532 0  L 0 0  L 0 247.612375  z " fill="none" />
  </g>
  <g id="03-399cc-axes_1">
   <g id="03-399cc-patch_2">
    <path d="M 147.2 206.928  L 658.544 206.928  L 658.544 7.2  L 147.2 7.2  L 147.2 206.928  z " fill="none" />
   </g>
   <g id="03-399cc-matplotlib.axis_1">
    <g id="03-399cc-xtick_1">
     <g id="03-399cc-line2d_1">
      <path d="M 147.2 206.928  L 147.2 7.2  " clip-path="url(#03-399cc-pa860f6bf1e)" fill="none" stroke="var(--divider)" stroke-width="0.7" stroke-linecap="square" />
     </g>
     <g id="03-399cc-line2d_2" />
     <g id="03-399cc-text_1">
      <text x="147.2" y="222.801594" transform="rotate(-0 147.2 222.801594)" fill="var(--text-secondary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="middle">0</text>
     </g>
    </g>
    <g id="03-399cc-xtick_2">
     <g id="03-399cc-line2d_3">
      <path d="M 275.036 206.928  L 275.036 7.2  " clip-path="url(#03-399cc-pa860f6bf1e)" fill="none" stroke="var(--divider)" stroke-width="0.7" stroke-linecap="square" />
     </g>
     <g id="03-399cc-line2d_4" />
     <g id="03-399cc-text_2">
      <text x="275.036" y="222.801594" transform="rotate(-0 275.036 222.801594)" fill="var(--text-secondary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="middle">50</text>
     </g>
    </g>
    <g id="03-399cc-xtick_3">
     <g id="03-399cc-line2d_5">
      <path d="M 402.872 206.928  L 402.872 7.2  " clip-path="url(#03-399cc-pa860f6bf1e)" fill="none" stroke="var(--divider)" stroke-width="0.7" stroke-linecap="square" />
     </g>
     <g id="03-399cc-line2d_6" />
     <g id="03-399cc-text_3">
      <text x="402.872" y="222.801594" transform="rotate(-0 402.872 222.801594)" fill="var(--text-secondary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="middle">100</text>
     </g>
    </g>
    <g id="03-399cc-xtick_4">
     <g id="03-399cc-line2d_7">
      <path d="M 530.708 206.928  L 530.708 7.2  " clip-path="url(#03-399cc-pa860f6bf1e)" fill="none" stroke="var(--divider)" stroke-width="0.7" stroke-linecap="square" />
     </g>
     <g id="03-399cc-line2d_8" />
     <g id="03-399cc-text_4">
      <text x="530.708" y="222.801594" transform="rotate(-0 530.708 222.801594)" fill="var(--text-secondary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="middle">150</text>
     </g>
    </g>
    <g id="03-399cc-xtick_5">
     <g id="03-399cc-line2d_9">
      <path d="M 658.544 206.928  L 658.544 7.2  " clip-path="url(#03-399cc-pa860f6bf1e)" fill="none" stroke="var(--divider)" stroke-width="0.7" stroke-linecap="square" />
     </g>
     <g id="03-399cc-line2d_10" />
     <g id="03-399cc-text_5">
      <text x="658.544" y="222.801594" transform="rotate(-0 658.544 222.801594)" fill="var(--text-secondary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="middle">200</text>
     </g>
    </g>
    <g id="03-399cc-text_6">
     <text x="402.872" y="238.112687" transform="rotate(-0 402.872 238.112687)" fill="var(--text-secondary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="middle">Ninja 400 = 100；横条为 ZX-4RR</text>
    </g>
   </g>
   <g id="03-399cc-matplotlib.axis_2">
    <g id="03-399cc-ytick_1">
     <g id="03-399cc-line2d_11" />
     <g id="03-399cc-text_7">
      <text x="139.2" y="29.948371" transform="rotate(-0 139.2 29.948371)" fill="var(--text-primary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="end">峰值功率</text>
     </g>
    </g>
    <g id="03-399cc-ytick_2">
     <g id="03-399cc-line2d_12" />
     <g id="03-399cc-text_8">
      <text x="139.2" y="70.477592" transform="rotate(-0 139.2 70.477592)" fill="var(--text-primary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="end">功率峰值转速</text>
     </g>
    </g>
    <g id="03-399cc-ytick_3">
     <g id="03-399cc-line2d_13" />
     <g id="03-399cc-text_9">
      <text x="139.2" y="111.000797" transform="rotate(-0 139.2 111.000797)" fill="var(--text-primary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="end">峰值扭矩</text>
     </g>
    </g>
    <g id="03-399cc-ytick_4">
     <g id="03-399cc-line2d_14" />
     <g id="03-399cc-text_10">
      <text x="139.2" y="151.536033" transform="rotate(-0 139.2 151.536033)" fill="var(--text-primary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="end">峰值功率时的平均活塞速度</text>
     </g>
    </g>
    <g id="03-399cc-ytick_5">
     <g id="03-399cc-line2d_15" />
     <g id="03-399cc-text_11">
      <text x="139.2" y="192.059238" transform="rotate(-0 139.2 192.059238)" fill="var(--text-primary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="end">整备质量</text>
     </g>
    </g>
   </g>
   <g id="03-399cc-patch_3">
    <path d="M 147.2 16.278545  L 583.526467 16.278545  L 583.526467 35.732571  L 147.2 35.732571  z " clip-path="url(#03-399cc-pa860f6bf1e)" fill="var(--accent)" />
   </g>
   <g id="03-399cc-patch_4">
    <path d="M 147.2 56.807766  L 517.9244 56.807766  L 517.9244 76.261792  L 147.2 76.261792  z " clip-path="url(#03-399cc-pa860f6bf1e)" fill="var(--accent)" />
   </g>
   <g id="03-399cc-patch_5">
    <path d="M 147.2 97.336987  L 416.692108 97.336987  L 416.692108 116.791013  L 147.2 116.791013  z " clip-path="url(#03-399cc-pa860f6bf1e)" fill="var(--chart-teal)" />
   </g>
   <g id="03-399cc-patch_6">
    <path d="M 147.2 137.866208  L 427.03251 137.866208  L 427.03251 157.320234  L 147.2 157.320234  z " clip-path="url(#03-399cc-pa860f6bf1e)" fill="var(--chart-teal)" />
   </g>
   <g id="03-399cc-patch_7">
    <path d="M 147.2 178.395429  L 434.831 178.395429  L 434.831 197.849455  L 147.2 197.849455  z " clip-path="url(#03-399cc-pa860f6bf1e)" fill="var(--chart-amber)" />
   </g>
   <g id="03-399cc-line2d_16">
    <path d="M 402.872 206.928  L 402.872 7.2  " clip-path="url(#03-399cc-pa860f6bf1e)" fill="none" stroke-dasharray="3.7,1.6" stroke-dashoffset="0" stroke="var(--text-secondary)" />
   </g>
   <g id="03-399cc-text_12">
    <text x="588.639907" y="28.595402" transform="rotate(-0 588.639907 28.595402)" fill="var(--text-primary)" font-size="10" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="start">170.7（+70.7%）</text>
   </g>
   <g id="03-399cc-text_13">
    <text x="523.03784" y="69.124623" transform="rotate(-0 523.03784 69.124623)" fill="var(--text-primary)" font-size="10" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="start">145.0（+45.0%）</text>
   </g>
   <g id="03-399cc-text_14">
    <text x="421.805548" y="109.653844" transform="rotate(-0 421.805548 109.653844)" fill="var(--text-primary)" font-size="10" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="start">105.4（+5.4%）</text>
   </g>
   <g id="03-399cc-text_15">
    <text x="432.14595" y="150.183065" transform="rotate(-0 432.14595 150.183065)" fill="var(--text-primary)" font-size="10" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="start">109.4（+9.4%）</text>
   </g>
   <g id="03-399cc-text_16">
    <text x="439.94444" y="190.712285" transform="rotate(-0 439.94444 190.712285)" fill="var(--text-primary)" font-size="10" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="start">112.5（+12.5%）</text>
   </g>
  </g>
 </g>
 <defs>
  <clipPath id="03-399cc-pa860f6bf1e">
   <rect x="147.2" y="7.2" width="511.344" height="199.728" />
  </clipPath>
 </defs>
</svg>
</div>
<p class="v-caption">图3｜由欧规厂商参数计算。两车均为399 cc；Ninja 400 为2023年款，ZX-4RR 为2024年款，后者采用不含 RAM air 增益的57 kW。不同年款与设计目标仍会影响结果。来源 <a href="#ref-7">[7]</a><a href="#ref-8">[8]</a>。</p>
</div>

短行程给了转速余地，但发动机还得吸进足够的空气。气门面积、配气正时、进排气调谐，以及气门机构能否承受高转，都在决定扭矩会不会提前掉下去。只把限转往上提，并不会凭空长出功率。<sup class="cite"><a href="#ref-10">10</a></sup>

大单缸也能走这条路。Ducati 698 Mono 的缸径达116 mm，行程却只有62.4 mm；配合钛进气门和 Desmodromic 配气，功率峰值到了9,750 rpm。它比这组 MT-07 的峰值功率还高5.6%。<sup class="cite"><a href="#ref-2">2</a></sup><sup class="cite"><a href="#ref-11">11</a></sup>

<div class="v-figure">
<img src="/2026/11/01/motorcycle-cylinders-displacement-vibration/assets/ducati-piston.jpg" alt="Ducati Superquadro Mono 的活塞与连杆，活塞顶有气门避让凹槽" loading="lazy" decoding="async">
<p class="v-caption">图 A｜116 mm 的活塞，配合62.4 mm短行程。大单缸也可以围绕高转设计。图片：Ducati 官方技术页，版权归 Ducati；不是本文绘制的结构图。<a href="#ref-11">[11]</a></p>
</div>

所以，“单缸低转、四缸高转”适合当第一印象，拿来判断具体发动机就不够了。同为660 cc三缸，2024 Daytona 660 的厂商功率是70 kW，Trident 660 是60 kW；连缸数和排量都没变，调校与用途仍能拉开差距。<sup class="cite"><a href="#ref-4">4</a></sup><sup class="cite"><a href="#ref-12">12</a></sup>

转速和齿比，解释了为什么一辆车会更快。可快慢之外，为什么有的发动机让人觉得一下是一下，有的又连绵得多？

<span id="7-油门响应、脉动和发动机制动，也不能只数气缸"></span>

## 5. 每一下做功，怎样变成手腕里的“性格”？

在4,000 rpm时，四冲程单缸每隔30毫秒做功一次；均匀点火四缸则每隔7.5毫秒就有一次做功。排量相近，分配到每次做功的份额和时间间隔都变了。

双缸内部也有不同节奏。360°、180°和270°曲轴，在一个完整循环里都有两次做功，但两次之间的间隔不同。下面只画事件发生的时刻，不把它冒充成扭矩波形。<sup class="cite"><a href="#ref-17">17</a></sup><sup class="cite"><a href="#ref-26">26</a></sup>

<div class="v-figure v-chart-scroll">
<p class="v-scroll-hint">横向滑动查看完整图表</p>
<div class="v-chart-viewport" tabindex="0" role="region" aria-label="做功事件的节奏">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 668.432 269.259821" version="1.1" role="img" aria-labelledby="04-pulses-title 04-pulses-desc" stroke-linejoin="round" stroke-linecap="butt">
 <title id="04-pulses-title">做功事件的节奏</title><desc id="04-pulses-desc">四冲程4000转每分钟的理想时序；单缸事件间隔30毫秒，360度双缸15毫秒，180度双缸7.5和22.5毫秒，270度双缸11.25和18.75毫秒，均匀三缸10毫秒，均匀四缸7.5毫秒。</desc><defs>
  </defs>
 <g id="04-pulses-figure_1">
  <g id="04-pulses-patch_1">
   <path d="M 0 269.259821  L 668.432 269.259821  L 668.432 0  L 0 0  L 0 269.259821  z " fill="none" />
  </g>
  <g id="04-pulses-axes_1">
   <g id="04-pulses-patch_2">
    <path d="M 81.2 228.44654  L 661.232 228.44654  L 661.232 22.81454  L 81.2 22.81454  L 81.2 228.44654  z " fill="none" />
   </g>
   <g id="04-pulses-matplotlib.axis_1">
    <g id="04-pulses-xtick_1">
     <g id="04-pulses-line2d_1">
      <path d="M 81.2 228.44654  L 81.2 22.81454  " clip-path="url(#04-pulses-pbffdd251aa)" fill="none" stroke="var(--divider)" stroke-width="0.7" stroke-linecap="square" />
     </g>
     <g id="04-pulses-line2d_2" />
     <g id="04-pulses-text_1">
      <text x="81.2" y="244.320134" transform="rotate(-0 81.2 244.320134)" fill="var(--text-secondary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="middle">0.0</text>
     </g>
    </g>
    <g id="04-pulses-xtick_2">
     <g id="04-pulses-line2d_3">
      <path d="M 187.303415 228.44654  L 187.303415 22.81454  " clip-path="url(#04-pulses-pbffdd251aa)" fill="none" stroke="var(--divider)" stroke-width="0.7" stroke-linecap="square" />
     </g>
     <g id="04-pulses-line2d_4" />
     <g id="04-pulses-text_2">
      <text x="187.303415" y="244.320134" transform="rotate(-0 187.303415 244.320134)" fill="var(--text-secondary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="middle">7.5</text>
     </g>
    </g>
    <g id="04-pulses-xtick_3">
     <g id="04-pulses-line2d_5">
      <path d="M 293.406829 228.44654  L 293.406829 22.81454  " clip-path="url(#04-pulses-pbffdd251aa)" fill="none" stroke="var(--divider)" stroke-width="0.7" stroke-linecap="square" />
     </g>
     <g id="04-pulses-line2d_6" />
     <g id="04-pulses-text_3">
      <text x="293.406829" y="244.320134" transform="rotate(-0 293.406829 244.320134)" fill="var(--text-secondary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="middle">15.0</text>
     </g>
    </g>
    <g id="04-pulses-xtick_4">
     <g id="04-pulses-line2d_7">
      <path d="M 399.510244 228.44654  L 399.510244 22.81454  " clip-path="url(#04-pulses-pbffdd251aa)" fill="none" stroke="var(--divider)" stroke-width="0.7" stroke-linecap="square" />
     </g>
     <g id="04-pulses-line2d_8" />
     <g id="04-pulses-text_4">
      <text x="399.510244" y="244.320134" transform="rotate(-0 399.510244 244.320134)" fill="var(--text-secondary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="middle">22.5</text>
     </g>
    </g>
    <g id="04-pulses-xtick_5">
     <g id="04-pulses-line2d_9">
      <path d="M 505.613659 228.44654  L 505.613659 22.81454  " clip-path="url(#04-pulses-pbffdd251aa)" fill="none" stroke="var(--divider)" stroke-width="0.7" stroke-linecap="square" />
     </g>
     <g id="04-pulses-line2d_10" />
     <g id="04-pulses-text_5">
      <text x="505.613659" y="244.320134" transform="rotate(-0 505.613659 244.320134)" fill="var(--text-secondary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="middle">30.0</text>
     </g>
    </g>
    <g id="04-pulses-text_6">
     <text x="371.216" y="259.749821" transform="rotate(-0 371.216 259.749821)" fill="var(--text-secondary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="middle">时间（ms）｜4,000 rpm；0–30 ms为一个720°循环</text>
    </g>
   </g>
   <g id="04-pulses-matplotlib.axis_2">
    <g id="04-pulses-ytick_1">
     <g id="04-pulses-line2d_11" />
     <g id="04-pulses-text_7">
      <text x="73.2" y="43.972931" transform="rotate(-0 73.2 43.972931)" fill="var(--text-primary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="end">单缸</text>
     </g>
    </g>
    <g id="04-pulses-ytick_2">
     <g id="04-pulses-line2d_12" />
     <g id="04-pulses-text_8">
      <text x="73.2" y="78.210693" transform="rotate(-0 73.2 78.210693)" fill="var(--text-primary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="end">360° 双缸</text>
     </g>
    </g>
    <g id="04-pulses-ytick_3">
     <g id="04-pulses-line2d_13" />
     <g id="04-pulses-text_9">
      <text x="73.2" y="112.448456" transform="rotate(-0 73.2 112.448456)" fill="var(--text-primary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="end">180° 双缸</text>
     </g>
    </g>
    <g id="04-pulses-ytick_4">
     <g id="04-pulses-line2d_14" />
     <g id="04-pulses-text_10">
      <text x="73.2" y="146.686218" transform="rotate(-0 73.2 146.686218)" fill="var(--text-primary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="end">270° 双缸</text>
     </g>
    </g>
    <g id="04-pulses-ytick_5">
     <g id="04-pulses-line2d_15" />
     <g id="04-pulses-text_11">
      <text x="73.2" y="180.92398" transform="rotate(-0 73.2 180.92398)" fill="var(--text-primary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="end">均匀点火三缸</text>
     </g>
    </g>
    <g id="04-pulses-ytick_6">
     <g id="04-pulses-line2d_16" />
     <g id="04-pulses-text_12">
      <text x="73.2" y="215.161742" transform="rotate(-0 73.2 215.161742)" fill="var(--text-primary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="end">均匀点火四缸</text>
     </g>
    </g>
   </g>
   <g id="04-pulses-LineCollection_1">
    <path d="M 81.2 40.036134  L 505.613659 40.036134  " clip-path="url(#04-pulses-pbffdd251aa)" fill="none" stroke="var(--divider)" />
   </g>
   <g id="04-pulses-LineCollection_2">
    <path d="M 81.2 32.161449  L 81.2 47.910819  " clip-path="url(#04-pulses-pbffdd251aa)" fill="none" stroke="var(--accent)" stroke-width="3" />
   </g>
   <g id="04-pulses-LineCollection_3">
    <path d="M 81.2 74.273896  L 505.613659 74.273896  " clip-path="url(#04-pulses-pbffdd251aa)" fill="none" stroke="var(--divider)" />
   </g>
   <g id="04-pulses-LineCollection_4">
    <path d="M 81.2 66.399211  L 81.2 82.148582  " clip-path="url(#04-pulses-pbffdd251aa)" fill="none" stroke="var(--chart-teal)" stroke-width="3" />
    <path d="M 293.406829 66.399211  L 293.406829 82.148582  " clip-path="url(#04-pulses-pbffdd251aa)" fill="none" stroke="var(--chart-teal)" stroke-width="3" />
   </g>
   <g id="04-pulses-LineCollection_5">
    <path d="M 81.2 108.511659  L 505.613659 108.511659  " clip-path="url(#04-pulses-pbffdd251aa)" fill="none" stroke="var(--divider)" />
   </g>
   <g id="04-pulses-LineCollection_6">
    <path d="M 81.2 100.636973  L 81.2 116.386344  " clip-path="url(#04-pulses-pbffdd251aa)" fill="none" stroke="var(--chart-teal)" stroke-width="3" />
    <path d="M 187.303415 100.636973  L 187.303415 116.386344  " clip-path="url(#04-pulses-pbffdd251aa)" fill="none" stroke="var(--chart-teal)" stroke-width="3" />
   </g>
   <g id="04-pulses-LineCollection_7">
    <path d="M 81.2 142.749421  L 505.613659 142.749421  " clip-path="url(#04-pulses-pbffdd251aa)" fill="none" stroke="var(--divider)" />
   </g>
   <g id="04-pulses-LineCollection_8">
    <path d="M 81.2 134.874736  L 81.2 150.624106  " clip-path="url(#04-pulses-pbffdd251aa)" fill="none" stroke="var(--chart-teal)" stroke-width="3" />
    <path d="M 240.355122 134.874736  L 240.355122 150.624106  " clip-path="url(#04-pulses-pbffdd251aa)" fill="none" stroke="var(--chart-teal)" stroke-width="3" />
   </g>
   <g id="04-pulses-LineCollection_9">
    <path d="M 81.2 176.987183  L 505.613659 176.987183  " clip-path="url(#04-pulses-pbffdd251aa)" fill="none" stroke="var(--divider)" />
   </g>
   <g id="04-pulses-LineCollection_10">
    <path d="M 81.2 169.112498  L 81.2 184.861868  " clip-path="url(#04-pulses-pbffdd251aa)" fill="none" stroke="var(--accent)" stroke-width="3" />
    <path d="M 222.67122 169.112498  L 222.67122 184.861868  " clip-path="url(#04-pulses-pbffdd251aa)" fill="none" stroke="var(--accent)" stroke-width="3" />
    <path d="M 364.142439 169.112498  L 364.142439 184.861868  " clip-path="url(#04-pulses-pbffdd251aa)" fill="none" stroke="var(--accent)" stroke-width="3" />
   </g>
   <g id="04-pulses-LineCollection_11">
    <path d="M 81.2 211.224945  L 505.613659 211.224945  " clip-path="url(#04-pulses-pbffdd251aa)" fill="none" stroke="var(--divider)" />
   </g>
   <g id="04-pulses-LineCollection_12">
    <path d="M 81.2 203.35026  L 81.2 219.099631  " clip-path="url(#04-pulses-pbffdd251aa)" fill="none" stroke="var(--accent)" stroke-width="3" />
    <path d="M 187.303415 203.35026  L 187.303415 219.099631  " clip-path="url(#04-pulses-pbffdd251aa)" fill="none" stroke="var(--accent)" stroke-width="3" />
    <path d="M 293.406829 203.35026  L 293.406829 219.099631  " clip-path="url(#04-pulses-pbffdd251aa)" fill="none" stroke="var(--accent)" stroke-width="3" />
    <path d="M 399.510244 203.35026  L 399.510244 219.099631  " clip-path="url(#04-pulses-pbffdd251aa)" fill="none" stroke="var(--accent)" stroke-width="3" />
   </g>
   <g id="04-pulses-line2d_17">
    <path d="M 505.613659 228.44654  L 505.613659 22.81454  " clip-path="url(#04-pulses-pbffdd251aa)" fill="none" stroke-dasharray="2.96,1.28" stroke-dashoffset="0" stroke="var(--text-secondary)" stroke-width="0.8" />
   </g>
   <g id="04-pulses-text_13">
    <text x="533.907902" y="42.618947" transform="rotate(-0 533.907902 42.618947)" fill="var(--text-primary)" font-size="10" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="start">30 ms</text>
   </g>
   <g id="04-pulses-text_14">
    <text x="533.907902" y="76.856709" transform="rotate(-0 533.907902 76.856709)" fill="var(--text-primary)" font-size="10" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="start">15 ms</text>
   </g>
   <g id="04-pulses-text_15">
    <text x="533.907902" y="111.094471" transform="rotate(-0 533.907902 111.094471)" fill="var(--text-primary)" font-size="10" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="start">7.5 / 22.5 ms</text>
   </g>
   <g id="04-pulses-text_16">
    <text x="533.907902" y="145.332233" transform="rotate(-0 533.907902 145.332233)" fill="var(--text-primary)" font-size="10" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="start">11.25 / 18.75 ms</text>
   </g>
   <g id="04-pulses-text_17">
    <text x="533.907902" y="179.569996" transform="rotate(-0 533.907902 179.569996)" fill="var(--text-primary)" font-size="10" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="start">10 ms</text>
   </g>
   <g id="04-pulses-text_18">
    <text x="533.907902" y="213.807758" transform="rotate(-0 533.907902 213.807758)" fill="var(--text-primary)" font-size="10" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="start">7.5 ms</text>
   </g>
   <g id="04-pulses-text_19">
    <text x="533.907902" y="14.357812" transform="rotate(-0 533.907902 14.357812)" fill="var(--text-secondary)" font-size="10" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="start">相邻事件间隔</text>
   </g>
  </g>
 </g>
 <defs>
  <clipPath id="04-pulses-pbffdd251aa">
   <rect x="81.2" y="22.81454" width="580.032" height="205.632" />
  </clipPath>
 </defs>
</svg>
</div>
<p class="v-caption">图4｜理论时序，不是实测扭矩波形。竖线只表示事件时刻，线高没有振幅含义；30 ms处为下一循环起点。依四冲程运动学计算，构型参照 <a href="#ref-17">[17]</a><a href="#ref-26">[26]</a>。</p>
</div>

做功事件更密集，通常更容易把输出接得平顺一些。至于手腕一动，车会不会立刻往前蹿，还要看油门映射、飞轮与传动系统惯量、传动间隙，以及当时的挡位。Daytona 660 的骑行模式就会改变油门响应与牵引力控制设定。<sup class="cite"><a href="#ref-12">12</a></sup>

“低扭好”也常混着三种体验：低转时确实能输出较大扭矩，低速不顿挫，或者不用降挡就能提速。试车时把它们分开感受，会比只问“有没有劲”清楚得多。

收油后的拖拽感同样要经过整套传动。泵气损失、摩擦、控制策略、挡位和滑动离合器，都会改变发动机制动。698 本身就有滑动离合器；缸数并不能直接给出谁的反拖最强。<sup class="cite"><a href="#ref-2">2</a></sup><sup class="cite"><a href="#ref-23">23</a></sup>

平均输出、做功节奏和油门控制，共同构成了我们感到的发动机“性格”。不过，这些输出还要推动整辆车。大单缸还有一个吸引人的地方：它经常出现在较轻的车上。

<span id="8-轻量化、油耗与保养：高转能力的另一面"></span>

## 6. 大单缸的吸引力，还在整辆车上

698 Mono 与 CB650R 的差别，拿功率表看很明显：57与70 kW，Honda 高了22.8%。

但698官方给出的151 kg，是不含燃油的湿重。按12 L油箱、燃油密度0.75 kg/L估算，满油约160 kg；CB650R 普通离合版的厂商整备质量为205 kg。两车都加上85 kg骑手，功率质量比的差距就缩到了3.8%。<sup class="cite"><a href="#ref-2">2</a></sup><sup class="cite"><a href="#ref-5">5</a></sup>

<div class="v-figure v-chart-scroll">
<p class="v-scroll-hint">横向滑动查看完整图表</p>
<div class="v-chart-viewport" tabindex="0" role="region" aria-label="轻量化如何缩小功率差距">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 704.776781 166.567281" version="1.1" role="img" aria-labelledby="05-mass-title 05-mass-desc" stroke-linejoin="round" stroke-linecap="butt">
 <title id="05-mass-title">轻量化如何缩小功率差距</title><desc id="05-mass-desc">CB650R相对698 Mono的峰值功率高22.8%；按车辆160与205千克、各加85千克骑手，峰值功率质量比高3.8%。698满油质量为估算。</desc><defs>
  </defs>
 <g id="05-mass-figure_1">
  <g id="05-mass-patch_1">
   <path d="M 0 166.567281  L 704.776781 166.567281  L 704.776781 0  L 0 0  L 0 166.567281  z " fill="none" />
  </g>
  <g id="05-mass-axes_1">
   <g id="05-mass-patch_2">
    <path d="M 64.120781 141.302281  L 305.89788 141.302281  L 305.89788 32.438281  L 64.120781 32.438281  L 64.120781 141.302281  z " fill="none" />
   </g>
   <g id="05-mass-matplotlib.axis_1">
    <g id="05-mass-xtick_1">
     <g id="05-mass-line2d_1">
      <path d="M 64.120781 141.302281  L 64.120781 32.438281  " clip-path="url(#05-mass-p78faf77e34)" fill="none" stroke="var(--divider)" stroke-width="0.7" stroke-linecap="square" />
     </g>
     <g id="05-mass-line2d_2" />
     <g id="05-mass-text_1">
      <text x="64.120781" y="157.175875" transform="rotate(-0 64.120781 157.175875)" fill="var(--text-secondary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="middle">0</text>
     </g>
    </g>
    <g id="05-mass-xtick_2">
     <g id="05-mass-line2d_3">
      <path d="M 121.00951 141.302281  L 121.00951 32.438281  " clip-path="url(#05-mass-p78faf77e34)" fill="none" stroke="var(--divider)" stroke-width="0.7" stroke-linecap="square" />
     </g>
     <g id="05-mass-line2d_4" />
     <g id="05-mass-text_2">
      <text x="121.00951" y="157.175875" transform="rotate(-0 121.00951 157.175875)" fill="var(--text-secondary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="middle">20</text>
     </g>
    </g>
    <g id="05-mass-xtick_3">
     <g id="05-mass-line2d_5">
      <path d="M 177.89824 141.302281  L 177.89824 32.438281  " clip-path="url(#05-mass-p78faf77e34)" fill="none" stroke="var(--divider)" stroke-width="0.7" stroke-linecap="square" />
     </g>
     <g id="05-mass-line2d_6" />
     <g id="05-mass-text_3">
      <text x="177.89824" y="157.175875" transform="rotate(-0 177.89824 157.175875)" fill="var(--text-secondary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="middle">40</text>
     </g>
    </g>
    <g id="05-mass-xtick_4">
     <g id="05-mass-line2d_7">
      <path d="M 234.786969 141.302281  L 234.786969 32.438281  " clip-path="url(#05-mass-p78faf77e34)" fill="none" stroke="var(--divider)" stroke-width="0.7" stroke-linecap="square" />
     </g>
     <g id="05-mass-line2d_8" />
     <g id="05-mass-text_4">
      <text x="234.786969" y="157.175875" transform="rotate(-0 234.786969 157.175875)" fill="var(--text-secondary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="middle">60</text>
     </g>
    </g>
    <g id="05-mass-xtick_5">
     <g id="05-mass-line2d_9">
      <path d="M 291.675698 141.302281  L 291.675698 32.438281  " clip-path="url(#05-mass-p78faf77e34)" fill="none" stroke="var(--divider)" stroke-width="0.7" stroke-linecap="square" />
     </g>
     <g id="05-mass-line2d_10" />
     <g id="05-mass-text_5">
      <text x="291.675698" y="157.175875" transform="rotate(-0 291.675698 157.175875)" fill="var(--text-secondary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="middle">80</text>
     </g>
    </g>
   </g>
   <g id="05-mass-matplotlib.axis_2">
    <g id="05-mass-ytick_1">
     <g id="05-mass-line2d_11" />
     <g id="05-mass-text_6">
      <text x="56.120781" y="55.959447" transform="rotate(-0 56.120781 55.959447)" fill="var(--text-primary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="end">698 Mono</text>
     </g>
    </g>
    <g id="05-mass-ytick_2">
     <g id="05-mass-line2d_12" />
     <g id="05-mass-text_7">
      <text x="56.120781" y="125.654709" transform="rotate(-0 56.120781 125.654709)" fill="var(--text-primary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="end">CB650R</text>
     </g>
    </g>
   </g>
   <g id="05-mass-patch_3">
    <path d="M 64.120781 37.386645  L 226.25366 37.386645  L 226.25366 66.658655  L 64.120781 66.658655  z " clip-path="url(#05-mass-p78faf77e34)" fill="var(--accent)" />
   </g>
   <g id="05-mass-patch_4">
    <path d="M 64.120781 107.081907  L 263.231334 107.081907  L 263.231334 136.353918  L 64.120781 136.353918  z " clip-path="url(#05-mass-p78faf77e34)" fill="var(--chart-teal)" />
   </g>
   <g id="05-mass-text_8">
    <text x="229.880316" y="54.863744" transform="rotate(-0 229.880316 54.863744)" fill="var(--text-primary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="start">57</text>
   </g>
   <g id="05-mass-text_9">
    <text x="266.85799" y="124.559006" transform="rotate(-0 266.85799 124.559006)" fill="var(--text-primary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="start">70</text>
   </g>
   <g id="05-mass-text_10">
    <text x="64.120781" y="16.438281" transform="rotate(-0 64.120781 16.438281)" fill="var(--text-primary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="start">发动机峰值功率（kW）</text>
   </g>
  </g>
  <g id="05-mass-axes_2">
   <g id="05-mass-patch_5">
    <path d="M 455.799682 141.302281  L 697.576781 141.302281  L 697.576781 32.438281  L 455.799682 32.438281  L 455.799682 141.302281  z " fill="none" />
   </g>
   <g id="05-mass-matplotlib.axis_3">
    <g id="05-mass-xtick_6">
     <g id="05-mass-line2d_13">
      <path d="M 455.799682 141.302281  L 455.799682 32.438281  " clip-path="url(#05-mass-p06ad626402)" fill="none" stroke="var(--divider)" stroke-width="0.7" stroke-linecap="square" />
     </g>
     <g id="05-mass-line2d_14" />
     <g id="05-mass-text_11">
      <text x="455.799682" y="157.175875" transform="rotate(-0 455.799682 157.175875)" fill="var(--text-secondary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="middle">0.0</text>
     </g>
    </g>
    <g id="05-mass-xtick_7">
     <g id="05-mass-line2d_15">
      <path d="M 533.792295 141.302281  L 533.792295 32.438281  " clip-path="url(#05-mass-p06ad626402)" fill="none" stroke="var(--divider)" stroke-width="0.7" stroke-linecap="square" />
     </g>
     <g id="05-mass-line2d_16" />
     <g id="05-mass-text_12">
      <text x="533.792295" y="157.175875" transform="rotate(-0 533.792295 157.175875)" fill="var(--text-secondary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="middle">0.1</text>
     </g>
    </g>
    <g id="05-mass-xtick_8">
     <g id="05-mass-line2d_17">
      <path d="M 611.784907 141.302281  L 611.784907 32.438281  " clip-path="url(#05-mass-p06ad626402)" fill="none" stroke="var(--divider)" stroke-width="0.7" stroke-linecap="square" />
     </g>
     <g id="05-mass-line2d_18" />
     <g id="05-mass-text_13">
      <text x="611.784907" y="157.175875" transform="rotate(-0 611.784907 157.175875)" fill="var(--text-secondary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="middle">0.2</text>
     </g>
    </g>
    <g id="05-mass-xtick_9">
     <g id="05-mass-line2d_19">
      <path d="M 689.77752 141.302281  L 689.77752 32.438281  " clip-path="url(#05-mass-p06ad626402)" fill="none" stroke="var(--divider)" stroke-width="0.7" stroke-linecap="square" />
     </g>
     <g id="05-mass-line2d_20" />
     <g id="05-mass-text_14">
      <text x="689.77752" y="157.175875" transform="rotate(-0 689.77752 157.175875)" fill="var(--text-secondary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="middle">0.3</text>
     </g>
    </g>
   </g>
   <g id="05-mass-matplotlib.axis_4">
    <g id="05-mass-ytick_3">
     <g id="05-mass-line2d_21" />
     <g id="05-mass-text_15">
      <text x="447.799682" y="55.959447" transform="rotate(-0 447.799682 55.959447)" fill="var(--text-primary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="end">698 Mono</text>
     </g>
    </g>
    <g id="05-mass-ytick_4">
     <g id="05-mass-line2d_22" />
     <g id="05-mass-text_16">
      <text x="447.799682" y="125.654709" transform="rotate(-0 447.799682 125.654709)" fill="var(--text-primary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="end">CB650R</text>
     </g>
    </g>
   </g>
   <g id="05-mass-patch_6">
    <path d="M 455.799682 37.386645  L 637.251883 37.386645  L 637.251883 66.658655  L 455.799682 66.658655  z " clip-path="url(#05-mass-p06ad626402)" fill="var(--accent)" />
   </g>
   <g id="05-mass-patch_7">
    <path d="M 455.799682 107.081907  L 644.057713 107.081907  L 644.057713 136.353918  L 455.799682 136.353918  z " clip-path="url(#05-mass-p06ad626402)" fill="var(--chart-teal)" />
   </g>
   <g id="05-mass-text_17">
    <text x="640.878539" y="54.863744" transform="rotate(-0 640.878539 54.863744)" fill="var(--text-primary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="start">0.233</text>
   </g>
   <g id="05-mass-text_18">
    <text x="647.684369" y="124.559006" transform="rotate(-0 647.684369 124.559006)" fill="var(--text-primary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="start">0.241</text>
   </g>
   <g id="05-mass-text_19">
    <text x="455.799682" y="16.438281" transform="rotate(-0 455.799682 16.438281)" fill="var(--text-primary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="start">车＋85 kg骑手：功率质量比（kW/kg）</text>
   </g>
  </g>
 </g>
 <defs>
  <clipPath id="05-mass-p78faf77e34">
   <rect x="64.120781" y="32.438281" width="241.777099" height="108.864" />
  </clipPath>
  <clipPath id="05-mass-p06ad626402">
   <rect x="455.799682" y="32.438281" width="241.777099" height="108.864" />
  </clipPath>
 </defs>
</svg>
</div>
<p class="v-caption">图5｜整车算例。CB650R 的功率高22.8%，加入骑手后功率质量比高3.8%。698按151 kg不含燃油湿重＋12 L×0.75 kg/L估算；这不是加速成绩预测。来源 <a href="#ref-2">[2]</a><a href="#ref-5">[5]</a>。</p>
</div>

这不是说两车加速只差3.8%。它说明轻量化为什么值得在功率之外单独看。滑胎车与街车的车架、油箱、座椅和装备都不同，那45 kg差距也不能全记到少了三个气缸的账上。

油耗就更不按缸数排队。这组2024年厂商数据里，MT-07 是4.2 L/100 km，698 是4.8，Trident 是4.7，CB650R 是4.9。单缸并没有自动排到最低。<sup class="cite"><a href="#ref-2">2</a>,<a href="#ref-3">3</a>,<a href="#ref-4">4</a>,<a href="#ref-5">5</a></sup>

保养也得看具体车。气缸少，缸内零件通常少一些；但平衡轴、配气形式、拆装难度、检查周期和零件价格都影响账单。没有同口径工时与费用，不能从缸数排出一张可靠性或养车成本榜。

这些取舍可以解释为什么有人明知大单缸不占马力优势，还是喜欢它。长途时，剩下那个绕不开的问题是：这样的做功和往复运动，会让人承受多少振动？

<span id="9-回到振动：结构劣势真实存在，长途结论仍要测整车"></span>
<span id="10-该怎样把这些取舍用在选车上？"></span>

## 7. 长途舒不舒服，要一直追到手、脚和座垫

单缸没有其他气缸帮助抵消往复惯性激励，这个结构条件真实存在。同一机构转得越快，部分惯性激励还会近似随转速平方增加。

现代大单缸会用平衡轴处理其中一些分量。Ducati 的 Superquadro Mono 使用两根平衡轴，厂商说明它们用于平衡一阶惯性力。<sup class="cite"><a href="#ref-11">11</a></sup>

<div class="v-figure">
<img src="/2026/11/01/motorcycle-cylinders-displacement-vibration/assets/ducati-balance-shafts.jpg" alt="Ducati Superquadro Mono 的两根平衡轴，可见用于产生平衡力的偏心质量" loading="lazy" decoding="async">
<p class="v-caption">图 B｜平衡轴用旋转的偏心质量处理特定惯性激励。它不会同时抹去燃烧扭矩脉动、所有高阶分量和整车共振。图片：Ducati 官方技术页，版权归 Ducati。<a href="#ref-11">[11]</a></p>
</div>

发动机产生的激励，还要经过安装点、车架、车把、脚踏和座垫，才到骑手身上。这个过程会放大某些频率，也会衰减另一些。四缸同样有需要处理的分量，例如常规平面曲轴直列四缸的二阶惯性合力。<sup class="cite"><a href="#ref-17">17</a>,<a href="#ref-18">18</a></sup>

真正量到接触点，会是什么样？Adamek 与 Schröter 的研究覆盖27辆摩托、23名骑手，累计约2,500 km。下面摘出五辆样车的车把结果。<sup class="cite"><a href="#ref-19">19</a></sup>

<div class="v-figure v-chart-scroll">
<p class="v-scroll-hint">横向滑动查看完整图表</p>
<div class="v-chart-viewport" tabindex="0" role="region" aria-label="振动要看具体车型和车速">
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 669.085562 309.216548" version="1.1" role="img" aria-labelledby="06-vibration-title 06-vibration-desc" stroke-linejoin="round" stroke-linecap="butt">
 <title id="06-vibration-title">振动要看具体车型和车速</title><desc id="06-vibration-desc">2016研究选取的五辆样车。两辆单缸在90公里每小时的车把值为6.92和2.81米每二次方秒。BMW单缸在90时低于ZXR400、130时略高。Twin改装过车把。</desc><defs>
  </defs>
 <g id="06-vibration-figure_1">
  <g id="06-vibration-patch_1">
   <path d="M 0 309.216548  L 669.085562 309.216548  L 669.085562 0  L 0 0  L 0 309.216548  z " fill="none" />
  </g>
  <g id="06-vibration-axes_1">
   <g id="06-vibration-patch_2">
    <path d="M 112.381563 268.403267  L 661.885562 268.403267  L 661.885562 44.843267  L 112.381563 44.843267  L 112.381563 268.403267  z " fill="none" />
   </g>
   <g id="06-vibration-matplotlib.axis_1">
    <g id="06-vibration-xtick_1">
     <g id="06-vibration-line2d_1">
      <path d="M 112.381563 268.403267  L 112.381563 44.843267  " clip-path="url(#06-vibration-pd9e6dd8a67)" fill="none" stroke="var(--divider)" stroke-width="0.7" stroke-linecap="square" />
     </g>
     <g id="06-vibration-line2d_2" />
     <g id="06-vibration-text_1">
      <text x="112.381563" y="284.276861" transform="rotate(-0 112.381563 284.276861)" fill="var(--text-secondary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="middle">0</text>
     </g>
    </g>
    <g id="06-vibration-xtick_2">
     <g id="06-vibration-line2d_3">
      <path d="M 201.01124 268.403267  L 201.01124 44.843267  " clip-path="url(#06-vibration-pd9e6dd8a67)" fill="none" stroke="var(--divider)" stroke-width="0.7" stroke-linecap="square" />
     </g>
     <g id="06-vibration-line2d_4" />
     <g id="06-vibration-text_2">
      <text x="201.01124" y="284.276861" transform="rotate(-0 201.01124 284.276861)" fill="var(--text-secondary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="middle">2</text>
     </g>
    </g>
    <g id="06-vibration-xtick_3">
     <g id="06-vibration-line2d_5">
      <path d="M 289.640917 268.403267  L 289.640917 44.843267  " clip-path="url(#06-vibration-pd9e6dd8a67)" fill="none" stroke="var(--divider)" stroke-width="0.7" stroke-linecap="square" />
     </g>
     <g id="06-vibration-line2d_6" />
     <g id="06-vibration-text_3">
      <text x="289.640917" y="284.276861" transform="rotate(-0 289.640917 284.276861)" fill="var(--text-secondary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="middle">4</text>
     </g>
    </g>
    <g id="06-vibration-xtick_4">
     <g id="06-vibration-line2d_7">
      <path d="M 378.270595 268.403267  L 378.270595 44.843267  " clip-path="url(#06-vibration-pd9e6dd8a67)" fill="none" stroke="var(--divider)" stroke-width="0.7" stroke-linecap="square" />
     </g>
     <g id="06-vibration-line2d_8" />
     <g id="06-vibration-text_4">
      <text x="378.270595" y="284.276861" transform="rotate(-0 378.270595 284.276861)" fill="var(--text-secondary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="middle">6</text>
     </g>
    </g>
    <g id="06-vibration-xtick_5">
     <g id="06-vibration-line2d_9">
      <path d="M 466.900272 268.403267  L 466.900272 44.843267  " clip-path="url(#06-vibration-pd9e6dd8a67)" fill="none" stroke="var(--divider)" stroke-width="0.7" stroke-linecap="square" />
     </g>
     <g id="06-vibration-line2d_10" />
     <g id="06-vibration-text_5">
      <text x="466.900272" y="284.276861" transform="rotate(-0 466.900272 284.276861)" fill="var(--text-secondary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="middle">8</text>
     </g>
    </g>
    <g id="06-vibration-text_6">
     <text x="387.133563" y="299.706548" transform="rotate(-0 387.133563 299.706548)" fill="var(--text-secondary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="middle">车把频率加权振动（m/s²），左右手结果的平均</text>
    </g>
   </g>
   <g id="06-vibration-matplotlib.axis_2">
    <g id="06-vibration-ytick_1">
     <g id="06-vibration-line2d_11" />
     <g id="06-vibration-text_7">
      <text transform="translate(32.255938 53.909382)" fill="var(--text-primary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif">KTM 660 SMC</text>
      <text transform="translate(53.628594 65.549101)" fill="var(--text-primary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif">2003 · 1缸</text>
     </g>
    </g>
    <g id="06-vibration-ytick_2">
     <g id="06-vibration-line2d_12" />
     <g id="06-vibration-text_8">
      <text transform="translate(33.479688 104.718473)" fill="var(--text-primary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif">BMW F650GS</text>
      <text transform="translate(53.628594 116.358192)" fill="var(--text-primary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif">2000 · 1缸</text>
     </g>
    </g>
    <g id="06-vibration-ytick_3">
     <g id="06-vibration-line2d_13" />
     <g id="06-vibration-text_9">
      <text transform="translate(7.2 155.527564)" fill="var(--text-primary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif">BMW F650GS Twin</text>
      <text transform="translate(53.628594 167.167283)" fill="var(--text-primary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif">2010 · 2缸</text>
     </g>
    </g>
    <g id="06-vibration-ytick_4">
     <g id="06-vibration-line2d_14" />
     <g id="06-vibration-text_10">
      <text transform="translate(13.897969 206.336655)" fill="var(--text-primary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif">Kawasaki ZXR400</text>
      <text transform="translate(53.628594 217.976374)" fill="var(--text-primary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif">1996 · 4缸</text>
     </g>
    </g>
    <g id="06-vibration-ytick_5">
     <g id="06-vibration-line2d_15" />
     <g id="06-vibration-text_11">
      <text transform="translate(28.562344 257.145746)" fill="var(--text-primary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif">Honda VFR800</text>
      <text transform="translate(57.29125 268.785464)" fill="var(--text-primary)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif">2002 · V4</text>
     </g>
    </g>
   </g>
   <g id="06-vibration-line2d_16">
    <path d="M 419.040246 55.005085  L 495.704917 55.005085  " clip-path="url(#06-vibration-pd9e6dd8a67)" fill="none" stroke="var(--divider)" stroke-width="2" stroke-linecap="square" />
   </g>
   <g id="06-vibration-line2d_17">
    <path d="M 236.906259 105.814176  L 341.04613 105.814176  " clip-path="url(#06-vibration-pd9e6dd8a67)" fill="none" stroke="var(--divider)" stroke-width="2" stroke-linecap="square" />
   </g>
   <g id="06-vibration-line2d_18">
    <path d="M 193.477717 156.623267  L 246.655524 156.623267  " clip-path="url(#06-vibration-pd9e6dd8a67)" fill="none" stroke="var(--divider)" stroke-width="2" stroke-linecap="square" />
   </g>
   <g id="06-vibration-line2d_19">
    <path d="M 254.189046 207.432358  L 326.865382 207.432358  " clip-path="url(#06-vibration-pd9e6dd8a67)" fill="none" stroke="var(--divider)" stroke-width="2" stroke-linecap="square" />
   </g>
   <g id="06-vibration-line2d_20">
    <path d="M 198.35235 258.241449  L 216.078285 258.241449  " clip-path="url(#06-vibration-pd9e6dd8a67)" fill="none" stroke="var(--divider)" stroke-width="2" stroke-linecap="square" />
   </g>
   <g id="06-vibration-PathCollection_1" />
   <g id="06-vibration-PathCollection_2">
    <path d="M 0 306.216548  L -1 308.216548  M 2 310.216548  L 0 306.216548  " clip-path="url(#06-vibration-pd9e6dd8a67)" fill="none" stroke="var(--chart-amber)" />
   </g>
   <g id="06-vibration-PathCollection_3">
    <defs>
     <path id="06-vibration-m21917cfebf" d="M 0 3.708099  C 0.983399 3.708099 1.926654 3.317391 2.622022 2.622022  C 3.317391 1.926654 3.708099 0.983399 3.708099 0  C 3.708099 -0.983399 3.317391 -1.926654 2.622022 -2.622022  C 1.926654 -3.317391 0.983399 -3.708099 0 -3.708099  C -0.983399 -3.708099 -1.926654 -3.317391 -2.622022 -2.622022  C -3.317391 -1.926654 -3.708099 -0.983399 -3.708099 0  C -3.708099 0.983399 -3.317391 1.926654 -2.622022 2.622022  C -1.926654 3.317391 -0.983399 3.708099 0 3.708099  z " stroke="var(--chart-teal)" />
    </defs>
    <g clip-path="url(#06-vibration-pd9e6dd8a67)">
     <use xlink:href="#06-vibration-m21917cfebf" x="419.040246" y="55.005085" fill="var(--chart-teal)" stroke="var(--chart-teal)" />
    </g>
   </g>
   <g id="06-vibration-PathCollection_4">
    <path d="M 495.704917 50.973956  L 491.673788 59.036214  L 499.736046 59.036214  L 495.704917 50.973956  z " clip-path="url(#06-vibration-pd9e6dd8a67)" fill="none" stroke="var(--chart-amber)" stroke-width="1.8" />
   </g>
   <g id="06-vibration-text_12">
    <text x="568.824401" y="57.846179" transform="rotate(-0 568.824401 57.846179)" fill="var(--chart-teal)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="middle">6.92</text>
   </g>
   <g id="06-vibration-text_13">
    <text x="630.865175" y="57.846179" transform="rotate(-0 630.865175 57.846179)" fill="var(--chart-amber)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="middle">8.65</text>
   </g>
   <g id="06-vibration-PathCollection_5">
    <g clip-path="url(#06-vibration-pd9e6dd8a67)">
     <use xlink:href="#06-vibration-m21917cfebf" x="236.906259" y="105.814176" fill="var(--chart-teal)" stroke="var(--chart-teal)" />
    </g>
   </g>
   <g id="06-vibration-PathCollection_6">
    <path d="M 341.04613 101.783047  L 337.015001 109.845305  L 345.077259 109.845305  L 341.04613 101.783047  z " clip-path="url(#06-vibration-pd9e6dd8a67)" fill="none" stroke="var(--chart-amber)" stroke-width="1.8" />
   </g>
   <g id="06-vibration-text_14">
    <text x="568.824401" y="108.65527" transform="rotate(-0 568.824401 108.65527)" fill="var(--chart-teal)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="middle">2.81</text>
   </g>
   <g id="06-vibration-text_15">
    <text x="630.865175" y="108.65527" transform="rotate(-0 630.865175 108.65527)" fill="var(--chart-amber)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="middle">5.16</text>
   </g>
   <g id="06-vibration-PathCollection_7">
    <g clip-path="url(#06-vibration-pd9e6dd8a67)">
     <use xlink:href="#06-vibration-m21917cfebf" x="193.477717" y="156.623267" fill="var(--chart-teal)" stroke="var(--chart-teal)" />
    </g>
   </g>
   <g id="06-vibration-PathCollection_8">
    <path d="M 246.655524 152.592138  L 242.624395 160.654396  L 250.686653 160.654396  L 246.655524 152.592138  z " clip-path="url(#06-vibration-pd9e6dd8a67)" fill="none" stroke="var(--chart-amber)" stroke-width="1.8" />
   </g>
   <g id="06-vibration-text_16">
    <text x="568.824401" y="159.464361" transform="rotate(-0 568.824401 159.464361)" fill="var(--chart-teal)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="middle">1.83</text>
   </g>
   <g id="06-vibration-text_17">
    <text x="630.865175" y="159.464361" transform="rotate(-0 630.865175 159.464361)" fill="var(--chart-amber)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="middle">3.03</text>
   </g>
   <g id="06-vibration-PathCollection_9">
    <g clip-path="url(#06-vibration-pd9e6dd8a67)">
     <use xlink:href="#06-vibration-m21917cfebf" x="254.189046" y="207.432358" fill="var(--chart-teal)" stroke="var(--chart-teal)" />
    </g>
   </g>
   <g id="06-vibration-PathCollection_10">
    <path d="M 326.865382 203.401229  L 322.834253 211.463487  L 330.896511 211.463487  L 326.865382 203.401229  z " clip-path="url(#06-vibration-pd9e6dd8a67)" fill="none" stroke="var(--chart-amber)" stroke-width="1.8" />
   </g>
   <g id="06-vibration-text_18">
    <text x="568.824401" y="210.273452" transform="rotate(-0 568.824401 210.273452)" fill="var(--chart-teal)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="middle">3.20</text>
   </g>
   <g id="06-vibration-text_19">
    <text x="630.865175" y="210.273452" transform="rotate(-0 630.865175 210.273452)" fill="var(--chart-amber)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="middle">4.84</text>
   </g>
   <g id="06-vibration-PathCollection_11">
    <g clip-path="url(#06-vibration-pd9e6dd8a67)">
     <use xlink:href="#06-vibration-m21917cfebf" x="198.35235" y="258.241449" fill="var(--chart-teal)" stroke="var(--chart-teal)" />
    </g>
   </g>
   <g id="06-vibration-PathCollection_12">
    <path d="M 216.078285 254.21032  L 212.047156 262.272578  L 220.109414 262.272578  L 216.078285 254.21032  z " clip-path="url(#06-vibration-pd9e6dd8a67)" fill="none" stroke="var(--chart-amber)" stroke-width="1.8" />
   </g>
   <g id="06-vibration-text_20">
    <text x="568.824401" y="261.082543" transform="rotate(-0 568.824401 261.082543)" fill="var(--chart-teal)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="middle">1.94</text>
   </g>
   <g id="06-vibration-text_21">
    <text x="630.865175" y="261.082543" transform="rotate(-0 630.865175 261.082543)" fill="var(--chart-amber)" font-size="11" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="middle">2.34</text>
   </g>
   <g id="06-vibration-text_22">
    <text x="568.824401" y="14.357812" transform="rotate(-0 568.824401 14.357812)" fill="var(--chart-teal)" font-size="10" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="middle">90 km/h</text>
   </g>
   <g id="06-vibration-text_23">
    <text x="630.865175" y="14.357812" transform="rotate(-0 630.865175 14.357812)" fill="var(--chart-amber)" font-size="10" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="middle">130 km/h</text>
   </g>
   <g id="06-vibration-legend_1">
    <g id="06-vibration-PathCollection_13">
     <defs>
      <path id="06-vibration-m05c6f48885" d="M 0 3  C 0.795609 3 1.55874 2.683901 2.12132 2.12132  C 2.683901 1.55874 3 0.795609 3 0  C 3 -0.795609 2.683901 -1.55874 2.12132 -2.12132  C 1.55874 -2.683901 0.795609 -3 0 -3  C -0.795609 -3 -1.55874 -2.683901 -2.12132 -2.12132  C -2.683901 -1.55874 -3 -0.795609 -3 0  C -3 0.795609 -2.683901 1.55874 -2.12132 2.12132  C -1.55874 2.683901 -0.795609 3 0 3  z " stroke="var(--chart-teal)" />
     </defs>
     <g>
      <use xlink:href="#06-vibration-m05c6f48885" x="131.381563" y="24.84208" fill="var(--chart-teal)" stroke="var(--chart-teal)" />
     </g>
    </g>
    <g id="06-vibration-text_24">
     <text x="149.381563" y="27.46708" transform="rotate(-0 149.381563 27.46708)" fill="var(--text-primary)" font-size="10" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="start">90 km/h</text>
    </g>
    <g id="06-vibration-PathCollection_14">
     <path d="M 214.950312 21.84208  L 211.950312 27.84208  L 217.950312 27.84208  L 214.950312 21.84208  z " fill="none" stroke="var(--chart-amber)" />
    </g>
    <g id="06-vibration-text_25">
     <text x="232.950312" y="27.46708" transform="rotate(-0 232.950312 27.46708)" fill="var(--text-primary)" font-size="10" font-family="Arial Unicode MS, Noto Sans CJK SC, sans-serif" text-anchor="start">130 km/h</text>
    </g>
   </g>
  </g>
 </g>
 <defs>
  <clipPath id="06-vibration-pd9e6dd8a67">
   <rect x="112.381563" y="44.843267" width="549.504" height="223.56" />
  </clipPath>
 </defs>
</svg>
</div>
<p class="v-caption">图6｜2016年研究中的五辆旧样车，不能据此给今天的车型排名。圆点为90 km/h，三角为130 km/h；连线仅配对同一辆车。F650GS Twin 为798 cc且改过车把。来源 <a href="#ref-19">[19]</a><a href="#ref-22">[22]</a>，未添加通用误差条。</p>
</div>

两辆单缸在90 km/h时的测量值相差2.46倍。BMW 单缸在这个速度下低于四缸 ZXR400；到130 km/h，两者的排序又反过来。

这些都是旧样车，车型年代、状态和改装并不一致，不能据此预测今天的690或698。但它们足以提醒我们：只数气缸，会漏掉很大的整车差异。

还有一个更直接的例子。Usamah 等人在一辆70 cc单缸车上，保留发动机、更换车把橡胶支承；最佳方案在特定巡航区间的两轴振动指标，从8.276降到了4.082 m/s²，下降50.7%。这个比例只属于该样车和该工况，却把“振动怎样传到手上”这件事展示得很清楚。<sup class="cite"><a href="#ref-21">21</a></sup>

长途还多了持续时间。按手臂振动常用的暴露量关系，加权振动幅值翻倍，达到同一暴露量所需的时间会缩到四分之一。它说明持续承受振动为什么值得在意；舒适度、路面冲击、风压和骑姿，则要另外考虑。本文不把这些实验换算成个人的“安全骑行分钟数”。<sup class="cite"><a href="#ref-24">24</a>,<a href="#ref-25">25</a></sup>

<div class="note primary"><p><i class="fa-solid fa-route" aria-hidden="true"></i> <strong>把试车落到你会用的速度上：</strong>记录车速、挡位和转速，分别感受手、脚与座垫。你喜欢的低速节奏，到了常用巡航转速，未必还是同一种感受。</p></div>

回到最初的选择：喜欢少换挡，就多看常用车速下的再加速和油门过渡；喜欢降挡拉转，就看高转输出、挡位衔接和整车重量；想骑长途，则要在自己的巡航工况里体验接触点振动。

缸数能解释设计者面对什么条件，却替你决定不了喜欢哪种节奏。试车时不妨分别记两件事：“这一下我很喜欢”，以及“这种情况下它确实更快”。前者可以留给自己，后者交给测量。

---

<span id="5-测功机告诉了我们什么，又漏掉了什么？"></span>
<span id="附录-A：比较与测量该怎样设计？"></span>
<span id="附录-B：数据口径与未解决的问题"></span>
<span id="附录-C：可复算代码"></span>

## 数据、计算与研究边界

正文沿着骑行感受展开。下面保留完整摘录数据、换算方法与限制，供想继续核查的人阅读。本文没有新增道路或台架实验；图1、图6来自实测，其余分别为厂商参数比较或明确假设下的计算。原始来源未提供逐次记录的地方，没有补画置信区间，也没有用几个峰值拼出完整扭矩曲线。

<details>
<summary>原始数据：发动机、道路测试、测功、质量与油耗</summary>

### 2024年厂商发动机参数

| 车型，全功率版 | 缸数 | 排量 cc | 缸径 × 行程 mm | 峰值功率 kW @ rpm | 峰值扭矩 N·m @ rpm |
| --- | ---: | ---: | --- | --- | --- |
| 698 Mono | 1 | 659 | 116 × 62.4 | 57 @ 9,750 | 63 @ 8,000 |
| MT-07 | 2 | 689 | 80 × 68.6 | 54 @ 8,750 | 67 @ 6,500 |
| Trident 660 | 3 | 660 | 74 × 51.1 | 60 @ 10,250 | 64 @ 6,250 |
| CB650R | 4 | 649 | 67 × 46.0 | 70 @ 12,000 | 63 @ 9,500 |

来源[2]–[5]。排量最多相差约6%，是案例选择，不是缸数的随机或代表性抽样。698为滑胎车，其余为街车。Trident取2024 Triple Tribute技术表的60 kW取整值，未混用A2版本。

2024 Daytona 660同为660 cc三缸：70 kW @ 11,250 rpm、69 N·m @ 8,250 rpm，限转12,650 rpm。[12] 对上述Trident表值计算，功率高16.7%、扭矩高7.8%；发布文字另写17%和9%。本文保留表值计算，不与其他页面69.8 kW的口径混用。

399 cc那一组的完整补充项为：Ninja 400整备质量168 kg，ZX-4RR为189 kg；后者57 kW不计RAM air增益，58.7 kW为另一口径。[7][8] 加85 kg骑手，峰值功率质量比由0.1320升至0.2080 kW/kg，相对高57.6%。这仍不能孤立出缸数的因果效应。

### 2021 Dueruote 同场测试

| 项目 | MT-07 | Trident 660 | CB650R |
| --- | ---: | ---: | ---: |
| 0–130 km/h，s | 7.3 | 7.1 | 5.9 |
| 静止起步400 m，s | 13.1 | 13.0 | 12.3 |
| 最高挡80–130 km/h，s | 7.2 | 6.7 | 8.4 |
| 满油整备质量，kg | 181.0 | 193.6 | 206.2 |

来源[1]的“Rilevamenti”表。CB650R的0–130用时比MT-07少19.2%；最高挡再加速用时比Trident多25.4%。未公开逐次测试、完整气象条件及误差区间；百分比描述当次样车，不是四缸相对双缸的平均效应。正文和参数区有个别不一致，本文只取上述明确标注的实测项。

### Cycle World 轮上测功

| 样车／记录 | 后轮功率 hp @ rpm | 换算 kW | 等效扭矩 lb·ft @ rpm | 换算 N·m |
| --- | --- | ---: | --- | ---: |
| MT-07，2021更新后CP2，2023指南回引 | 67 @ 8,700 | 50.0 | 46.3 @ 6,250 | 62.8 |
| Trident 660，2021测试 | 72.05 @ 10,200 | 53.7 | 42.85 @ 6,660 | 58.1 |
| CB650R，2021测试 | 81.90 @ 10,870 | 61.1 | 42.97 @ 7,960 | 58.3 |
| ZX-4RR，2023美规，2024发表 | 56.3 @ 11,700 | 42.0 | 25.8 @ 11,300 | 35.0 |

来源[9][13]–[15]。$1\ \mathrm{hp}=0.745699872\ \mathrm{kW}$，$1\ \mathrm{lb\,ft}=1.355817948\ \mathrm{N\,m}$。hp为机械马力，PS为公制马力，$1\ \mathrm{PS}\approx0.735499\ \mathrm{kW}$；厂商已列kW时直接使用。

Trident、Honda、ZX-4RR文章明确使用Dynojet 250i。相同媒体不代表同日、同环境对照；这些也不是对2024规格车的逐车复测。美规ZX-4RR的41.98 kW轮上值不能直接与欧规57 kW相除，解释成传动效率。

底盘测功图里的等效扭矩为 $T_{\mathrm{eq}}=P_{\mathrm{wheel}}/\omega_e$，已经包含传动损失，但没有乘上总减速比；它不是后轮轴实际扭矩。不能直接把图上的60 N·m除以轮胎半径来算地面推力。

Trident原始测功文章描述从约3,500 rpm起达到峰值扭矩的90%以上，呈现较宽平台，并非无限延伸到任何转速。[14] Ducati厂商说明698在3,000 rpm约有70%峰值扭矩，即约44.1 N·m，4,500–10,250 rpm不低于80%，即约50.4 N·m。[11] 两种测量口径不能直接排位；这些区间描述也不足以生成统一、完整的四车曲线。

### 整车质量、油耗和油箱

| 2024车型 | 本文车辆质量 kg | 加85 kg骑手 kg | 功率／总质量 kW/kg | 官方油耗 L/100 km | 油箱 L |
| --- | ---: | ---: | ---: | ---: | ---: |
| 698 Mono | 160，满油估算 | 245 | 0.2327 | 4.8 | 12 |
| MT-07 | 184，厂商湿重 | 269 | 0.2007 | 4.2 | 14 |
| Trident 660 | 189，厂商湿重 | 274 | 0.2190 | 4.7 | 14 |
| CB650R | 205，普通离合版 | 290 | 0.2414 | 4.9 | 15.4 |

来源[2]–[5]；698以151 kg不含燃油湿重补9 kg燃油，密度0.75 kg/L为假设。未再加入行李或装备，也未统一称重；Honda E-Clutch版的207 kg不在此表内。厂商认证或规定工况油耗不是实骑承诺，更不能由全油门峰值推算部分负荷效率。摩擦损失还包括曲轴、往复组件、配气、附件与气体交换等部分。[23]

</details>

<details>
<summary>振动数据：测了哪里、用了什么指标</summary>

### 2016年道路研究中的五辆样车

| 样车 | 构型 | 90 km/h车把 | 130 km/h车把 | 130 km/h座垫垂向 |
| --- | --- | ---: | ---: | ---: |
| KTM 660 SMC，2003 | 单缸 | 6.92 | 8.65 | 2.70 |
| BMW F650GS，2000 | 单缸 | 2.81 | 5.16 | 0.72 |
| BMW F650GS Twin，2010 | 双缸 | 1.83 | 3.03 | 0.57 |
| Kawasaki ZXR400，1996 | 直列四缸 | 3.20 | 4.84 | 1.19 |
| Honda VFR800，2002 | V4 | 1.94 | 2.34 | 0.65 |

单位均为m/s²，来源[19]表4、5。车把为三轴频率加权后左右手结果的平均；座垫是垂向频率加权RMS，评价方法不同，不能跨列直接比较不适程度。Twin实际排量798 cc，且样车改过车把、加厚座垫，不能按名字“650”当成严格同排量对照。[22]

同一研究的项目页报告，同车换骑手的手臂结果相对基准可变化−17%至+16%；同车同骑手重复测量约±7%。[20] 这是该研究的观察范围，不是每个点都适用的置信区间，也不是独立新增样本。图6因此没有把±7%画成通用误差条。

### 2022年70 cc单缸的车把隔振实验

| 方案 | 论文均值 m/s² | 相对原车降低，本文计算 |
| --- | ---: | ---: |
| 原车 | 8.276 | — |
| A | 5.823 | 29.6% |
| B | 5.398 | 34.8% |
| C | 6.135 | 25.9% |
| D | 4.082 | 50.7% |

来源[21]表3。约3,000–3,600 rpm、50–60 km/h的区间平均，按手部y、z两方向计算；不能与上一表的三轴值混排。改善幅度取决于这辆样车、橡胶参数和测试区间，不能推广为所有橡胶车把的收益。

</details>

<details>
<summary>计算关系：BMEP、活塞速度、齿比与做功时序</summary>

### 平均扭矩与转速

四冲程一循环转两圈，做功 $W=4\pi T$；定义 $\mathrm{BMEP}=W/V_d$，于是：

{% raw %}<div>$$
\begin{aligned}
T&amp;=\frac{\mathrm{BMEP}\,V_d}{4\pi} \\
\mathrm{BMEP}\;(\mathrm{bar})&amp;=\frac{40\pi T\;(\mathrm{N\,m})}{V_d\;(\mathrm{cc})}
\end{aligned}
$$</div>{% endraw %}

这是输出端等效平均压力，不是缸内瞬时峰值压力。平均活塞速度为 $\bar v_p=2Sn/60$，其中行程 $S$ 用m。功率峰值处的扭矩由 $T=60000P/(2\pi n)$ 反算。

| 2024车型 | 峰值扭矩处BMEP bar | 功率峰值处扭矩 N·m | 占峰值扭矩 | 功率峰值处平均活塞速度 m/s |
| --- | ---: | ---: | ---: | ---: |
| 698 Mono | 12.01 | 55.83 | 88.6% | 20.28 |
| MT-07 | 12.22 | 58.93 | 88.0% | 20.01 |
| Trident 660 | 12.19 | 55.90 | 87.3% | 17.46 |
| CB650R | 12.20 | 55.70 | 88.4% | 18.40 |

399 cc案例中，Ninja 400和ZX-4RR的对应活塞速度为17.27与18.90 m/s，功率峰值处扭矩为31.89与37.54 N·m。

若固定总排量，假定气缸几何相似，则缸径、行程随 $N^{-1/3}$ 缩小；相同平均活塞速度下，允许转速随 $N^{1/3}$ 增加。一缸到四缸的比例为 $4^{1/3}\approx1.587$。这是几何缩放模型，不是实车转速预测。气缸顶面总面积也按 $N^{1/3}$ 缩放，但它不等于真实气门流通面积或充气效率。连杆比、活塞加速度、摩擦与配气限制也没有被这个简化模型覆盖。[6][10]

### 从发动机到后轮

离合器接合、忽略轮胎滑移的准稳态下：

{% raw %}<div>$$
\begin{aligned}
F_{\mathrm{drive}}&amp;=\frac{\eta T_eG}{r} \\
n&amp;=\frac{60vG}{2\pi r} \\
F_{\mathrm{drive}}&amp;=\frac{P_{\mathrm{wheel}}}{v}
\end{aligned}
$$</div>{% endraw %}

$G$为初级减速、当前挡位和终传动比的乘积；$r$为有效滚动半径，$v$用m/s，$\eta$为传动效率。最后一式用于 $v>0$ 的行驶状态，不能在零车速推出无限大的起步力。

实际加速度近似 $a=(F_{\mathrm{drive}}-F_{\mathrm{resistance}})/m_{\mathrm{effective}}$，要减风阻、滚阻、坡度阻力，并计入旋转惯量。低挡还可能受到附着、抬头限制。

理想加速换挡点在相邻挡位牵引力曲线交点附近，并受限转、换挡耗时、牵引力控制与操作影响。没有完整曲线和齿比，不能由峰值扭矩转速推算各车最佳换挡点。

698六挡估算采用：初级1.968，六挡26/25，终传动42/15，故 $G=5.730816$；后胎160/60 ZR17按标称尺寸得到几何半径0.3119 m。[2] 80、100、120 km/h对应约3,900、4,870、5,850 rpm。忽略轮胎变形和滑移，不是仪表或GPS实测。

### 响应与时序

空挡升转近似满足 $J_{\mathrm{eq}}\,d\omega/dt=T_{\mathrm{combustion}}-T_{\mathrm{loss}}-T_{\mathrm{load}}$。惯量包括活塞、连杆、曲轴、飞轮和离合器等；少缸并不保证总惯量低，上路后车辆质量又经传动折算为负载。全油门测功曲线也不能替代油门阶跃响应测试。

四冲程每秒平均做功事件数为 $f_{\mathrm{events}}=Nn/120$。在4,000 rpm时：

| 构型 | 每秒事件数 | 相邻间隔 ms |
| --- | ---: | --- |
| 单缸 | 33.3 | 30 |
| 360°并列双缸 | 66.7 | 15 / 15 |
| 180°并列双缸 | 66.7 | 7.5 / 22.5 |
| 270°并列双缸 | 66.7 | 11.25 / 18.75 |
| 均匀点火三缸 | 100.0 | 10 |
| 均匀点火四缸 | 133.3 | 7.5 |

图4以事件起点作理想化标记，不表示有限燃烧持续时间、点火提前角或瞬时扭矩幅值。单缸此时的事件频率33.3 Hz、曲轴一阶66.7 Hz、二阶133.3 Hz是不同概念；整车频谱还包含传动、共振和路面输入。

Yamaha对2004 YZR-M1 crossplane开发的解释，关注降低惯性扭矩对输出的干扰，不均匀点火是曲轴方案的结果之一。[16] 这是厂商的设计动机说明，不能转换成所有270°双缸的抓地力增益百分比或排名。

</details>

<details>
<summary>平衡、暴露时间，以及怎样设计更有说服力的测试</summary>

往复机构前两阶惯性力近似：[17][18]

{% raw %}<div>$$
F\approx mr\omega^2\left(\cos\theta+\frac{r}{l}\cos2\theta\right)
$$</div>{% endraw %}

这里 $m$为等效往复质量，$r$为曲柄半径，$l$为连杆长度；本式的 $r$ 与传动公式中的轮胎半径是不同量。同一机构从4,000到6,000 rpm，这部分激励幅值按平方关系增至2.25倍；经过整车传递后，手部响应并不必然同样增大2.25倍。

理想同尺寸并列双缸中，180°方案可抵消一阶合力，仍有摇摆力偶和二阶合力；270°方案可抵消二阶合力，仍须处理一阶力与力偶。常规平面曲轴直列四缸仍有二阶合力。[17][18][26] 这些结论不能套用到所有V型、水平对置或特殊曲轴。

若手臂加权加速度恒定，日暴露量 $A(8)=a_{hv}\sqrt{T/(8\,\mathrm h)}$；多工况按加速度平方乘时间累加。[24][25] 仅作代数演示，8.276与4.082的等暴露时间比为 $(8.276/4.082)^2\approx4.11$。2022论文给出的约197分钟，与其表3均值代入平方关系得到约180分钟存在差异，本文不采用前者作建议。两轴且区间平均的输入，本身也不足以完成正式三轴职业暴露评估；职业指标不能直接当作个人舒适或安全时长。

如果希望把本文的案例比较推进成更强的证据，可以分开做以下试验：

- **发动机输出：**固定年款、地区版本、燃料和改装，记录测功机、校准、修正方法、挡位、胎压、温度、升速率与电子模式。每车多次重复，公开逐点数据，区分惯性升速与固定转速负载试验。
- **道路性能：**分别测试最高挡再加速、允许降挡再加速和静止起步。固定骑手与载荷，双向测试减小风和坡度影响；相应速度试验应在合法、封闭且适当防护的环境中进行。
- **人体振动：**同步记录车把、脚踏、座垫的三轴加速度，以及车速、挡位、转速。重复路线、轮换骑手、平衡顺序，分开分析发动机阶次与路面输入，使用手臂和全身各自的评价方法。

比较两辆具体的车，配对试验就有价值；要推论缸数的效果，则每种缸数需要多个车型、每款需要多个样车，避免缸数与品牌、年代、用途重合。传感器产生再多采样点，也不会自动增加独立样车数。本文没有做缸数的因果回归，旧车数据也不用于给新车排序。

</details>

<span id="参考文献与数据定位"></span>

## 参考文献与图片来源

资料核查基于2026年11月1日的原稿；2026年11月2日复核发布内容、网站样式与新增官方配图。车型年份按各条所列，未将2026年的改款混入旧年款比较。下面是实际使用的原始测评、厂商资料、研究论文及讲义。

1. <span class="ref-anchor" id="ref-1"></span>Christian Cavaciuti / Dueruote. *Naked medie: l'era della BIODIVERSITÀ*，网页更新2021-08-19，纸刊测试见2021年4月号。[原始同场测试](https://www.dueruote.it/prove/prove-redazione/2021/honda-cb650r-triumph-trident-660-yamaha-mt-07-la-prova.html)。定位“Prestazioni → Rilevamenti”：0–130、0–400 m、最高挡80–130，以及“PESO → In ordine di marcia e serbatoio pieno”。正文与参数区有个别不一致，本文不混取。

2. <span class="ref-anchor" id="ref-2"></span>Ducati. *Hypermotard 698 Mono MY2024 Brochure*。[官方PDF](https://assets.ctfassets.net/x7j9qwvpvr5s/2uv5IzqlzeyafN6OfO7ejj/a70f40d80ac880cbc2b96f98669dd52f/Hypermotard_698_Mono_MY_2024_Brochure_ENG.pdf)。主要定位印刷第38–39页技术表（PDF第20页跨页）：排量、缸径行程、功率扭矩、质量、油耗、齿比和轮胎。151 kg为不含燃油湿重。

3. <span class="ref-anchor" id="ref-3"></span>Yamaha Motor Europe. *2024 MT-07 / MT07A Factsheet*。[官方PDF](https://cdn2.yamaha-motor.eu/prod/product-assets/2024/MT07A/Factsheets/2024-MT07A_en-GB.pdf)。定位 Engine、Dimensions；[同年官方备用版本](https://cdn2.yamaha-motor.eu/prod/product-assets/2024/MT07A/Factsheets/2024-MT07A_sr-Latn-RS.pdf)。用于2024年发动机、质量、油箱及油耗。

4. <span class="ref-anchor" id="ref-4"></span>Triumph Motorcycles. *Triumph Unveils Trident 660 Special Edition*，2024。[官方媒体资料](https://triumph-mediakits.com/en/news-articles/triumph-unveils-trident-660-special-edition.html)。定位 Specification、Consumption and Emissions。本文采用 Triple Tribute 的60 kW取整值、64 N·m、189 kg及4.7 L/100 km。

5. <span class="ref-anchor" id="ref-5"></span>Honda Motor Europe. *24YM Honda CB650R*，2023发布、2024车型年。[英文资料](https://hondanews.eu/eu/en/motorcycles/media/pressreleases/457025/24ym-honda-cb650r)；[葡萄牙语官方完整参数](https://hondanews.eu/pt/pt/motorcycles/media/pressreleases/459620/honda-cb650r-24ym)。英文页面存在访问限制，以同车型年葡语页核对。采用普通离合版205 kg，不是 E-Clutch 的207 kg。

6. <span class="ref-anchor" id="ref-6"></span>Wai Cheng / MIT OpenCourseWare. *2.61 Internal Combustion Engines, Lecture 2: Engine operating characteristics*，2017。[讲义PDF](https://ocw.mit.edu/courses/2-61-internal-combustion-engines-spring-2017/cf3aaf55ae71710c9bfd3056515b9b67_MIT2_61S17_lec2.pdf)。PDF第1、3页涉及道路负载、齿比、车速与发动机转速、BMEP。文中牵引力算例由功率和力学关系自行推导。

7. <span class="ref-anchor" id="ref-7"></span>Kawasaki Europe / Česká Republika. *Ninja 400 MY2023: Specifications*。[官方参数](https://www.kawasaki.cz/cs/products/Supersport___Sport/2023/Ninja_400/specifications?Uid=0898C1BYX1hYC14MXVkKXFxZW1AKDVwKXl8MC1AMUV4LX18)。定位 Motor、Výkon & Převodovka、Rám & Rozměry；采用欧规37 N·m，未混入其他年份38 N·m的数据。

8. <span class="ref-anchor" id="ref-8"></span>Kawasaki Europe / Česká Republika. *Ninja ZX-4RR MY2024: Specifications*。[官方参数](https://www.kawasaki.cz/cs/products/Supersport___Sport/2024/Ninja_ZX-4RR/specifications?Uid=0898WApeXgpYCg1fWwsLXAxfXlFcUAtZCgtYX1lfWwxRUF8)。用于399 cc、57×39.1 mm、57 kW、39 N·m、189 kg。RAM air 口径另见[2024官方产品册](https://www.kawasaki.eu/content/dam/europe/master/pdf-files/brochures/Kawasaki_Brochure_FullLine_2024.pdf)的 ZX-4RR 技术页，区分57.0与58.7 kW。

9. <span class="ref-anchor" id="ref-9"></span>Evan Allen / Cycle World. *How Much Power Does the 2023 Kawasaki Ninja ZX-4RR Make?*，2024-02-01。[原始轮上测功](https://www.cycleworld.com/bikes/kawasaki-ninja-zx-4rr-dyno-test-2023/)。Dynojet 250i，56.3 hp @ 11,700 rpm、25.8 lb·ft @ 11,300 rpm；本文只用于展示地区版本和测量位置不能混用。

10. <span class="ref-anchor" id="ref-10"></span>Wai Cheng / MIT OpenCourseWare. *Lecture 8: Intake and exhaust processes*，2017。[讲义PDF](https://ocw.mit.edu/courses/2-61-internal-combustion-engines-spring-2017/6ec38b3fc5493e328115e0a49a565f35_MIT2_61S17_lec8.pdf)。PDF第1页为气门关闭时刻与转速取舍，第4–6页涉及流动损失、惯性充气、调谐、回流等。

11. <span class="ref-anchor" id="ref-11"></span>Ducati. *Superquadro Mono*。[官方发动机技术页](https://www.ducati.com/ww/en/company/innovation/engines/superquadro-mono)。用于钛进气门与 Desmodromic 配气、平衡轴、3,000 rpm的70%扭矩及4,500–10,250 rpm的80%区间。区间百分比与平衡效果属于厂商说明，不是独立人体振动测试。

12. <span class="ref-anchor" id="ref-12"></span>Triumph Motorcycles. *2024 Daytona 660*。[官方媒体技术包](https://triumph-mediakits.com/en/all-motorcycles/roadsters/2024-daytona-660.html)。定位 Engine and Transmission、Thrilling Sports Performance、Rider-Focused Technology。采用本页70 kW、69 N·m及转速，不混用其他页面69.8 kW的取整口径；发布文字百分比与表值复算差异见原始数据附录。

13. <span class="ref-anchor" id="ref-13"></span>Cycle World. *2023 Yamaha MT-07 Buyer's Guide*。[原始测试媒体对其测功结果的回引](https://www.cycleworld.com/yamaha/mt-07-2023/)。定位 Powertrain: Engine, Transmission, and Performance，67 hp @ 8,700 rpm、46.3 lb·ft @ 6,250 rpm。该页回顾2021更新后的 CP2，本文不把指南年份当成独立新增测试年份。

14. <span class="ref-anchor" id="ref-14"></span>Michael Gilbert / Cycle World. *How Much Power Does the 2021 Triumph Trident 660 Make?*，2021-06-21。[原始测功](https://www.cycleworld.com/story/bikes/how-much-power-does-the-2021-triumph-trident-660-make/)。Dynojet 250i；72.05 hp、42.85 lb·ft；正文说明约3,500 rpm起达到90%以上峰值扭矩。本文未从图像猜读逐点数据。

15. <span class="ref-anchor" id="ref-15"></span>Michael Gilbert / Cycle World. *How Much Power Does the 2021 Honda CB650R Make?*，2021-07-21。[原始测功](https://www.cycleworld.com/story/bikes/2021-honda-cb650r-dyno-test/)。Dynojet 250i；81.90 hp、42.97 lb·ft及各自峰值转速。

16. <span class="ref-anchor" id="ref-16"></span>Yamaha Motor. *Challenges Carving Our Name into Racing History — 2000s*。[厂商工程历史说明](https://global.yamaha-motor.com/race/wgp-60th/history/2000.html)。定位2004年 YZR-M1 的 crossplane 曲轴与 inertial torque 讨论。采用其设计动机解释，不将赛车成绩作为单一结构的因果证据。

17. <span class="ref-anchor" id="ref-17"></span>Tony Foale. *Some science of balance*，2007。[作者技术文章PDF](https://motochassis.com/Articles/EngineBalance/EngineBalance.pdf)。用于惯性力、扭矩脉动、曲轴相位与摇摆力偶的区分。

18. <span class="ref-anchor" id="ref-18"></span>C.-J. Kim. *Location of unbalance mass and supporting bearing for different type of balance shaft module*，Mechanical Sciences 9，259–266，2018。[论文](https://ms.copernicus.org/articles/9/259/2018/index.html)；[DOI: 10.5194/ms-9-259-2018](https://doi.org/10.5194/ms-9-259-2018)。主要参见§2.1；本文使用前两阶惯性力近似，不使用更高阶展开项。

19. <span class="ref-anchor" id="ref-19"></span>J. Adamek; M. Schröter. *Humanschwingungen an Motorrädern bei unterschiedlichen Fahrzuständen / Human Vibration on Motorcycles at Different Driving Conditions*，VDI-Berichte 2277，179–198，2016，ISBN 978-3-18-092277-5。[作者机构公开PDF](https://www.hs-osnabrueck.de/fileadmin/HSOS/Homepages/Motorradhumanschwingungen/Humanschwingungen-an-Motorraedern-Adamek-VDI-Humanschwingungen_2016.pdf)。本文取表4、5，分别位于PDF第11、12页；完整研究另有车型、速度和脚踏等数据，不能将本文选表视作完整数据库。

20. <span class="ref-anchor" id="ref-20"></span>Hochschule Osnabrück. *Motorrad-Humanschwingungen*。[研究项目页](https://www.hs-osnabrueck.de/motorrad-humanschwingungen/)。定位 Fahrer/in-Einfluss、Reproduzierbarkeit und Sensorposition。骑手影响及重复性范围属于[19]同一研究，不另计样本。

21. <span class="ref-anchor" id="ref-21"></span>N. M. Usamah; A. Z. Ahmad Mazlan; Z. M. Ripin. *Investigation of Motorcycle Handle Vibration Attenuation Using a Suspended Handlebar With Different Rubber Mount Characteristics*，International Journal of Acoustics and Vibration 27(3)，276–284，2022。[DOI: 10.20855/ijav.2022.27.31872](https://doi.org/10.20855/ijav.2022.27.31872)；[全文PDF](https://www.iiav.org/ijav/content/volumes/27_2022_443331648541588/vol_3/1872_fullpaper_239811664189229.pdf)。§3说明样车，§4.6及期刊第282页表3为巡航区间均值与方向口径；暴露时间差异见折叠附录。

22. <span class="ref-anchor" id="ref-22"></span>BMW Group. *BMW Special Models “30 Years GS”*，2010。[官方技术资料PDF](https://www.press.bmwgroup.com/canada/article/attachment/T0080354EN/120675)。用于确认 F650GS Twin 的798 cc实际排量；[2000年 F650GS 官方资料](https://www.press.bmwgroup.com/canada/article/detail/T0032214EN/bmw-introduces-new-f-650-gs?language=en)核对旧单缸身份。

23. <span class="ref-anchor" id="ref-23"></span>Wai Cheng / MIT OpenCourseWare. *Lecture 19: Engine friction and tribology*，2017。[讲义PDF](https://ocw.mit.edu/courses/2-61-internal-combustion-engines-spring-2017/ad971a51c4a7f2db8a20f9570c870f0d_MIT2_61S17_lec19.pdf)。PDF第1–2页为损失定义及构成，第4页为泵气与负载关系。本文不据汽车示例估算摩托车油耗百分比。

24. <span class="ref-anchor" id="ref-24"></span>UK Health and Safety Executive. *The hand-arm vibration exposure calculator*。[方法说明](https://www.hse.gov.uk/vibration/hav/calculator-guide.htm)。用于 $A(8)$ 与时间换算。职业暴露管理指标不等于个人舒适度或安全骑行时长。

25. <span class="ref-anchor" id="ref-25"></span>UK Health and Safety Executive. *Hand-arm vibration: The Control of Vibration at Work Regulations 2005, L140*。[指导文件PDF](https://www.hse.gov.uk/pubns/priced/l140.pdf)。用于三轴、频率加权和多工况日暴露的计算方法；本文没有声称审阅付费 ISO 标准全文。

26. <span class="ref-anchor" id="ref-26"></span>C. Hubmann; W. Schoeffmann; H. Friedl; B. Graf. *360° vs. 270° vs. 180°: The Difference of Balancing a 2 Cylinder Inline Engine: Design, Simulation, Comparative Measurements*，SAE Technical Paper 2012-32-0106，2012。[DOI](https://doi.org/10.4271/2012-32-0106)；[SAE公开摘要](https://saemobilus.sae.org/papers/360-vs-270-vs-180-difference-balancing-a-2-cylinder-inline-engine-design-simulation-comparative-measurements-2012-32-0106)。本稿依据摘要核对构型差异，未取得全文实验数据，不引用其未公开数值。

