---
title: "Agent Step Value: When the evaluator changes the value of a step"
date: 2026-10-14 15:26:00
categories:
  - Silicon & Circuits
  - AI Research
etoc: true
toc:
  number: false
tags:
  - Agent Step Value
  - LLM Agents
  - Evaluation
  - EMNLP 2026
  - REALM
description: "Why the same frozen agent step can receive opposite reward signs across evaluation channels, and how a matched audit can locate and test that sensitivity."
keywords: Agent Step Value, ASV, process rewards, evaluation channels, REALM, EMNLP 2026
mathjax: true
---

<div class="asv-paper-panel">
<div class="asv-paper-meta"><span>RESEARCH PAPER</span><span>arXiv:2607.04419 · v5 · DOI 10.48550/arXiv.2607.04419</span></div>
<div class="asv-paper-preview"><a href="https://arxiv.org/abs/2607.04419v5" target="_blank" rel="noopener"><img src="/2026/10/14/agent-step-value/paper-title.jpg" alt="Agent Step Value: paper title, authors, and affiliations."></a></div>
<div class="asv-paper-footer"><span>REALM Workshop · EMNLP 2026 · Poster<br>Chengzhan Li · Co-first author</span><a class="glass-pill" href="https://arxiv.org/abs/2607.04419v5" target="_blank" rel="noopener"><i class="fas fa-file-alt" aria-hidden="true"></i> Read on arXiv</a></div>
</div>

The question behind the paper is fairly simple: if an evaluator says an agent step helped, will it still say that after we change how it sees the step?

In our frozen PubMed question-answering traces, cross-channel gain signs disagreed on **48.3%** of comparisons. Repeating the scoring within the same channel produced **0.3%** disagreement. The steps had not changed. The measurement channel had.

The practical concern is what happens when we reuse a step reward. A step labeled helpful under one scoring setup can become harmful under another, even when we replay exactly the same states. This post follows that measurement problem from a small example to the retrieval experiments and a source-restricted follow-up. The workshop recording is at the end.

> **The central finding:** the same frozen steps often receive opposite reward signs across channels. A matched before/after comparison can reveal that sensitivity; retrieval controls can help locate it and test a repair.

## 1. What changes when the evaluator changes?

Agents leave traces: a plan, a search call, retrieved evidence, a draft, a revision. A final outcome tells us whether the whole run succeeded. A step reward tries to say something about an intermediate update.

That reward can guide search, label training traces, or become a signal for policy optimization. Reusing it introduces a measurement problem. We may replace the judge, add a generated explanation, change the scoring prompt, or average several evaluator configurations. Before treating those scores as interchangeable, we need to know whether they agree on which direction the agent moved.

We use *evaluation channel* for the full configuration that produces a score. It includes the prompt, the source rules, any added view, the readout, the evaluator stack, and presentation settings.

An added view deserves particular attention. In our generated-view channel, an external model interprets the projected state and fixed candidate manifest before scoring. Its interpretation can describe support, contradiction, missing evidence, or ambiguity. We freeze that text and give it to the scorer alongside the state. The scorer itself does not generate the view.

We compare three input arrangements:

| Channel | What the scorer reads |
| :--- | :--- |
| Direct | The projected state, without an added view |
| Quote | The state plus a deterministic excerpt of the state |
| Generated view | The state plus a frozen interpretation produced by an external generator |

The generated view may be useful as a representation. But it can also express apparent support that the retrieved evidence does not contain. Since the state remains in the scorer input, the view introduces no newly observed task variable. It changes how the existing material reaches the evaluator.

## 2. ASV: measure the step within one channel

For a frozen transition, let $x^-$ be the state before the step and $x^+$ the state after it. Let $F_\rho(x)$ be the evaluator's target margin under channel $\rho$. Agent Step Value (ASV) is

$$
G^\rho = F_\rho(x^+) - F_\rho(x^-).
$$

A positive gain means the evaluator assigns more support to the reviewed target after the step. A negative gain means it assigns less. This is evaluator-assigned movement on a frozen trace; it does not establish the step's causal contribution to the actor's success.

<details>
<summary>How the target margin is computed</summary>

In our implementation, each task has three concrete candidates and a `none-of-the-above` option. We turn the candidate energies into a target-versus-rest margin. With the induced target probability $q(g)$, the margin is

$$
F = \log\frac{q(g)}{1-q(g)}.
$$

For intuition, a margin gain of +0.16 multiplies target-versus-rest odds by about 1.17. The probability change depends on where those odds started. The binary readout uses independently elicited Yes/No energies followed by an induced normalization, so its scale needs separate treatment.

</details>

{% asset_img asv-mechanics.jpg From frozen states to endpoint margins, within-channel gains, and their matched difference. Figure 4 of the paper. %}

## 3. Four scores make a fair comparison

Comparing a before-state score from one evaluator with an after-state score from another sounds tempting. It mixes two changes: the agent's state and the evaluation channel.

The matched design scores both endpoints under both channels. The interaction is the difference between the two gains:

$$
\begin{aligned}
\Omega &= G^{\rho_1} - G^{\rho_0} \\
&= [F_{\rho_1}(x^+) - F_{\rho_1}(x^-)] \\
&\quad - [F_{\rho_0}(x^+) - F_{\rho_0}(x^-)].
\end{aligned}
$$

A constant channel offset cancels inside each bracket. A nonzero interaction records a channel response that depends on the state. Without structural restrictions, dropping any of the four scores leaves this interaction unidentified.

The presentation uses this illustrative example:

| Evaluation channel | Before | After | ASV |
| :--- | ---: | ---: | ---: |
| Direct/reference | -0.2 | +0.4 | +0.6 |
| Generated view | +0.5 | +0.1 | -0.4 |

The direct channel calls the update helpful; the generated-view channel calls it harmful. Their interaction is -1.0. A diagonal comparison from direct-before (-0.2) to generated-after (+0.1) gives +0.3, which identifies neither within-channel gain nor their interaction.

<div class="asv-diagram">

<div class="v-figure">
<svg viewBox="0 0 760 400" role="img" aria-label="ASV gain chart"><defs><marker id="aA" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="#29648f"/></marker><marker id="aB" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="#a34a4a"/></marker></defs><text x="30" y="36" font-size="11" fill="#7b8b99" letter-spacing="2" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">ASV · FOUR CORNERS</text><text x="30" y="58" font-size="11" fill="#7b8b99" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">同一通道内 before → after；两个 gain 的差是 interaction</text><line x1="120" y1="320" x2="700" y2="320" stroke="rgba(70,102,126,.25)"/><text x="700" y="340" text-anchor="end" font-size="10" fill="#7b8b99" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">evaluator score</text><g font-size="10" fill="#7b8b99" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif"><text x="120" y="340">-0.6</text><text x="330" y="340">0</text><text x="580" y="340">+0.6</text></g><text x="30" y="134" font-size="11" fill="#4d6072" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">Direct</text><text x="30" y="254" font-size="11" fill="#4d6072" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">Generated</text><line x1="285.71428571428567" y1="130" x2="534.2857142857142" y2="130" stroke="#29648f" stroke-width="2.5" marker-end="url(#aA)"/><circle cx="285.71428571428567" cy="130" r="4" fill="#29648f"/><circle cx="534.2857142857142" cy="130" r="4" fill="#29648f"/><text x="409.99999999999994" y="116" text-anchor="middle" font-size="11" fill="#29648f" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">gain +0.6</text><line x1="575.7142857142858" y1="250" x2="410" y2="250" stroke="#a34a4a" stroke-width="2.5" marker-end="url(#aB)"/><circle cx="575.7142857142858" cy="250" r="4" fill="#a34a4a"/><circle cx="410" cy="250" r="4" fill="#a34a4a"/><text x="492.8571428571429" y="276" text-anchor="middle" font-size="11" fill="#a34a4a" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">gain -0.4</text><path d="M690,150 L720,150 L720,230 L690,230" fill="none" stroke="#7b8b99" stroke-dasharray="3 3"/><text x="732" y="196" font-size="11" fill="#7b8b99" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">-1.0</text><text x="120" y="380" font-size="9.5" fill="#7b8b99" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">数值为论文中的 illustrative example，不是 cohort estimate。</text></svg>
<p class="v-caption">图 1：四个分数的读法。两条 gain 都在各自通道内计算；它们的差是 interaction。</p>
</div>

</div>

*Reading the four corners: each gain uses one channel throughout. The numbers are illustrative, not cohort estimates.*

{% asset_img asv-pipeline.jpg The audit design: freeze the transition, replay both channels, complete the four-corner face, and check the observed readout/evaluator configurations. Figure 1 of the paper. %}

We emphasize gain signs because they survive positive affine recalibration within a channel. If we multiply a channel's scores by a positive constant and add an offset, its gain retains its sign. Cross-channel interaction magnitudes generally do not have that invariance unless the scales are linked. Two channels can also have a nonzero interaction while both gains remain positive.

## 4. The main result: channel changes outweigh retries

We froze 100 PubMed tasks from one actor workflow. Each task contributed 11 transitions, covering classification, planning, retrieval, drafting, audit, revision, and finalization: 1,100 transitions in total. We kept the states and candidate contracts fixed, and used four cyclic candidate layouts to balance option-label position.

The first acquisition retained 1,004 transitions with complete scores across the required endpoints and layouts. The retry analysis used 975 transitions complete in both new scoring waves. The generated views stayed frozen during retry, so that comparison measures repeat scoring with the same acquired inputs.

| Comparison on the retry cohort | Gain-sign disagreement | 95% trajectory-bootstrap interval |
| :--- | ---: | :--- |
| Across channels, averaged over four wave pairings | 48.3% | [45.2%, 51.5%] |
| Same-channel retries | 0.3% | [0.1%, 0.6%] |
| Paired excess | 48.0 percentage points | [44.9, 51.3] |

These disagreements run in both directions. Among the 468 transitions whose disagreement orientation remained stable across all four cross-channel wave pairings, 218 were direct-positive/generated-negative, while 250 were direct-negative/generated-positive.

That distinction matters. The result does not say that generated views make every step look worse, or that direct scoring always assigns the correct reward.

<div style="text-align:center;"><img src="/2026/10/14/agent-step-value/effect-anatomy.jpg" alt="The distribution of gain pairs and interactions helps separate widespread sign disagreement from the direction of the cohort mean. Figure 5 of the paper." style="width:72%;max-width:900px;height:auto;"></div>

<details>
<summary>Why the cohort means depend on target weighting</summary>

Under the first acquisition's empirical target mixture, the direct mean gain was +0.163 [0.102, 0.218], and the generated-view mean was -0.160 [-0.244, -0.079]. Yet the interaction median was +0.014, and 496 of 1,004 interactions were negative. The negative mean interaction came from larger negative magnitudes, rather than an overwhelming majority of negative interactions.

Changing the target weights changes the population summary. With equal weight on the four reviewed-target identities, the mean interaction remained negative at -0.213 [-0.343, -0.090], but the direct gain was +0.004 [-0.044, 0.057]. That weighting does not support a strict positive-to-negative mean reversal. The 48.3% versus 0.3% comparison is the main finding; the opposite cohort means need their weighting condition attached.

</details>

## 5. Retrieval: locate the channel difference

The global result tells us that the channels disagree. To investigate why, we focus on retrieval: the state changes when evidence arrives, while the generated interpretation changes too. Which coordinate accounts for the negative component?

We crossed the before and after states with the views generated at each endpoint. This gives a symmetric allocation of the retrieval change to the state coordinate and the view coordinate. On the 91 trajectories complete for that face, the state allocation was +0.224 [-0.029, 0.473], while the generated-view allocation was -0.915. The negative component sat in the view coordinate of this matched comparison.

{% asset_img retrieval-decomposition.jpg The symmetric retrieval face separates state and generated-view allocations. Allocation uses 91 complete trajectories; comparisons requiring the direct path use 88. Figure 2 of the paper. %}

We then held prompt structure fixed and changed only the view field. Under the shared template with neutral authority, the mean quote gain was +0.903 [0.443, 1.360], and the generated-view gain was -0.403 [-0.712, -0.104]. The generated-minus-quote interaction was -1.306 [-1.822, -0.797].

Quote and empty views also differed. A deterministic excerpt is therefore not automatically equivalent to presenting the state alone. Still, the generated view added a further negative interaction within the same prompt structure, so the finding did not depend only on a direct-versus-buffered template difference.

## 6. Check the direction with other instruments

The retrieval contrast could depend on the particular scoring instrument. We therefore repeated the matched state-by-view comparison at three observed configurations:

| Configuration | Readout | Evaluator stack | Mean quote/generated gain signs |
| :--- | :--- | :--- | :--- |
| A | Joint option-label probabilities | DeepSeek | Positive / negative |
| B | Candidate-wise Yes/No energies | DeepSeek | Positive / negative |
| C | Candidate-wise Yes/No energies | GPT-4o | Positive / negative |

All 100 trajectories were complete across four matched acquisition waves. Under the empirical target mixture, the mean quote gain was positive and the generated-view gain negative at every observed configuration, with each gain interval separated from zero.

<details>
<summary>What the three configurations do and do not establish</summary>

The three checks use native operational scales. The generated-minus-quote interactions were -1.305, -0.882, and -8.278 respectively, but those numbers should not be read as a ranking of effect strength across instruments. Joint and binary readouts implement different response functionals.

We did not observe the joint-readout/GPT-4o configuration. The bridge checks direction at three vertices; it does not identify a full readout-by-stack interaction. Equal-target weighting also leaves the three-vertex sign conjunction unresolved.

</details>

{% asset_img matched-bridge-results.jpg Panel A shows the three observed sign checks on separate native scales. Panel B shows the matched source-contract follow-up on artifact-bearing retrievals. Figure 3 of the paper. %}

<details>
<summary>A separate check against stored task success</summary>

Quote-channel post-retrieval margins ranked stored task success better than generated-view margins in all three configurations. The paired AUC advantages were +0.169, +0.165, and +0.267. The quote AUC intervals include or touch 0.5, so this supports a relative ranking advantage over the generated view, rather than strong standalone prediction of success.

</details>

## 7. A source restriction tests the inflated baseline

The presentation's mechanism is easiest to see in the subtraction itself: gain is after minus before. If generated text makes the evaluator unusually confident before evidence arrives, retrieval has a higher baseline to beat.

We tested this explanation in a separate matched follow-up. Both generators had a 512-token cap. One used the baseline contract without an explicit source-only clause; the other began with a restriction to information explicitly present inside `<EVIDENCE>`, and required absent support or contradiction to be marked as missing.

Before retrieval, none of the 100 states contained a retrieved artifact. A deterministic parser nevertheless detected support claims for at least one concrete candidate in 97 of the baseline generated views. Under the source-only contract, it detected none.

For the 65 retrieval transitions that acquired an evidence artifact, the matched gains were:

| View | Mean gain | 95% trajectory-bootstrap interval |
| :--- | ---: | :--- |
| Baseline generated view, 512 tokens | -1.915 | [-2.531, -1.322] |
| Source-only generated view, 512 tokens | +3.894 | [2.706, 5.008] |
| Quote | +1.453 | [0.793, 2.080] |

The paired source-only shift was +5.809 [4.729, 6.902]. In the 35 transitions that acquired no artifact, the shift was -0.340 [-0.987, 0.284], without a corresponding positive result. Across all 100 retrievals, source-only generation lowered the mean before margin more than the mean after margin. Together, these observations support the inflated-baseline explanation in this matched setting.

The original replay used 128-token views, and we did not audit its support claims. The 512-token intervention supports a mechanism for the follow-up, but does not verify that mechanism for the original headline result. The source instruction also changes several admissible-source rules at once, and we did not independently validate the parser by manual annotation. The artifact cohorts follow retrieval outcomes rather than randomized assignment.

<div class="asv-diagram asv-evidence">

{% mermaid %}
%%{init: {"flowchart": {"htmlLabels": false, "nodeSpacing": 18, "rankSpacing": 24}, "themeVariables": {"fontSize": "14px"}}}%%
flowchart TD
  A["Frozen steps: signs disagree"] -->|repeat scoring| B["Channel gap exceeds retry noise"]
  B -->|cross state and view| C["Retrieval: locate the view effect"]
  C -->|vary instrument| D["Check three instruments"]
  D -->|restrict sources| E["512-token source-only follow-up"]
{% endmermaid %}

</div>

*The evidence sequence. The source-contract follow-up tests a mechanism in its own matched setting; it does not prove the mechanism for the original 128-token replay.*

Restoring positive gain is also weaker than making the channels equivalent. Source-only and quote gains still differed. The intervention repaired the observed mean direction on artifact-bearing retrievals, not the full response law.

## 8. How I would audit a step reward

For a new evaluator or process-reward setup, I would use this sequence:

1. Freeze the before and after states, the candidates, and any generated views.
2. Score both endpoints within each declared channel. Compute each gain before comparing channels.
3. Repeat scoring with those inputs fixed to measure retry instability.
4. If the channel gap exceeds that instability, hold the template fixed and test the view or source rules.
5. Recheck the repaired channel on the matched transitions before pooling or reusing its rewards.

Averaging prompt variants can reduce variance. It also selects a mixture of channels. When their gains straddle zero, changing the mixture weights can change the reward's sign. An average by itself does not establish agreement.

<details>
<summary>Additional controls: length and authority instructions</summary>

Our buffered-scoring controls further show why interventions need matched comparisons. Own views differed from length-matched donor views by -4.080 [-5.060, -3.104], which is inconsistent with a simple length-only account. An evidence-primary instruction shifted gain positively by +2.272 in that control suite, yet its contrast was -0.243 in the separate matched cube. Those experiments used different templates, cohorts, and reference conditions; their authority effects estimate different quantities.

</details>

The four-corner design extends beyond our candidate-margin implementation. A scalar judge or process-reward model can supply the endpoint response directly. Hold the transition fixed and compare both endpoints within each declared channel. Interpret signs within an instrument, and link scales before comparing magnitudes across instruments.

This study covers 100 PubMed tasks, one actor workflow, and the observed configurations. It does not establish a universal disagreement rate, causal actor credit, or a general rule that generated interpretations are harmful. It gives us a way to ask whether an evaluator-derived reward keeps its direction when the measurement channel changes, and to test a localized repair when it does not.

## 9. Paper and presentation

<div class="asv-paper-links" aria-label="Paper formats">
<a class="glass-pill" href="https://arxiv.org/abs/2607.04419v5" target="_blank" rel="noopener"><i class="fas fa-file-alt" aria-hidden="true"></i> arXiv · v5</a>
<a class="glass-pill" href="https://arxiv.org/pdf/2607.04419v5" target="_blank" rel="noopener"><i class="fas fa-file-pdf" aria-hidden="true"></i> Read PDF</a>
<a class="glass-pill" href="https://arxiv.org/html/2607.04419v5" target="_blank" rel="noopener"><i class="fas fa-code" aria-hidden="true"></i> Read HTML</a>
</div>

The recording below walks through the audit, the retrieval checks, and the source-only follow-up in about four and a half minutes. All five figures above come from the paper; the explanation follows the workshop slides.

<video controls preload="metadata" playsinline poster="/2026/10/14/agent-step-value/talk-poster.jpg" style="width:100%;height:auto;border-radius:12px;">
  <source src="/2026/10/14/agent-step-value/asv-realm-2026-talk-web.mp4" type="video/mp4">
  Your browser does not support embedded video. <a href="/2026/10/14/agent-step-value/asv-realm-2026-talk-web.mp4">Download the presentation recording.</a>
</video>

