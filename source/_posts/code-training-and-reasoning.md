---
title: "读代码能让大模型更会做推理题吗？"
date: 2026-11-27 20:20:00
lang: zh-CN
published: true
categories: Silicon & Circuits
tags:
  - 大语言模型
  - Transformer
  - 预训练
  - 计算机体系结构
etoc: true
toc:
  max_depth: 2
mathjax: true
description: "翻译模型早就会逐词生成。为什么今天同一套权重还能写代码、答应用题？从一笔跳过的订单讲起，拆开预训练的续写目标、Transformer 的训练并行和推理时的逐步作答。"
---

{% note primary %}
最近看访谈，有两个说法放在一起让我想了很久。一个是，大模型多读些代码，有时连没写一行代码的推理题也能做得更好。另一个是，这些能力最后都体现在同一个动作上：给定前文，把下一个 token 猜得更准。要是逐词生成早就有了，为什么今天同一套模型能写程序，也能做一道中文应用题？
{% endnote %}

<!-- more -->

仓库里有 6 件货，三笔订单先后要 4 件、5 件和 2 件。每单必须一次给齐，不够就跳过，继续处理下一单。最后还剩几件？

第一笔发走 4 件，第二笔要 5 件，跳过，最后一笔正好发完余下的 2 件。要是把账本写成“每笔处理后剩余 2、__、0 件”，空里就该填 2。对下一格的预测只有一个数字，却要分清第二笔订单进了账本，库里的货一件也没动。给模型多读些代码，究竟能不能让它更会处理这样的前文？

<span id="一、翻译模型也能学到翻译以外的东西" class="ref-anchor"></span>

## 一、翻译模型早就会逐词生成

2014 年的英译法模型已经在做类似的事。Sutskever 等人用一套 LSTM 读英语，再用另一套 LSTM 生成法语。训练时，给解码器已经写好的那部分参考译文，让它预测下一词。翻译新句子时，参考译文还不存在，解码器沿自己已经生成的译文往下写，直到句末。这套权重从平行语料学的是翻译。单独训练的影评分类器则可以直接在好评和差评之间二选一，输出由任务事先规定。<sup class="cite"><a href="#ref-16">[16]</a></sup>

当时也有人把学到的东西带出原任务。2015 年，Dai 和 Le 先让循环网络读无标签文本，再用学到的权重初始化分类器。Luong 等人则让翻译和句法分析共用编码器，两个任务各有生成答案的解码器。一个是在两次训练之间传权重，一个是在同一次训练里共用部分权重。<sup class="cite"><a href="#ref-1">[1]</a></sup><sup class="cite"><a href="#ref-2">[2]</a></sup>

{% visual_svg code-training-and-reasoning/fig-01-training %}
图 1｜上半部用两份标注数据训练各自的模型。下半部从混合语料练习续写，推理时换一段提示，就能用同一套权重生成译文或类别词。原创训练范式示意。
{% endvisual_svg %}

今天常见的做法把共享往前推了一步。影评、程序和附了解答的习题，本身就是一长串例题，每个位置实际出现的 token 都可以拿来给预测打分。token 可以是词、词的一部分，也可以是一段标点。用的时候，给同一个模型“请译成法语”或“这条评论是好评还是差评？”，续写的内容就有了不同用途。GPT-3 的少样本实验直接在提示里放示例，冻结同一套权重做翻译、问答等任务。不过，既然下一项预测早就做得了，能从没有任务标签的续写里学到多少？<sup class="cite"><a href="#ref-15">[15]</a></sup>

2017 年 4 月，Transformer 论文发表前两个月，Radford 等人就用八千多万条亚马逊评论训练了一个 mLSTM。它一个字节一个字节地读，训练时只猜下一个字节。研究者比较了 4096 个状态分量在几项分类任务里的贡献，发现其中一个对褒贬特别敏感。在 IMDb 影评上，用标签给这个数定一道分界线，分类准确率是 92.30%。用全部分量训练分类器，是 92.88%。<sup class="cite"><a href="#ref-3">[3]</a></sup>

{% visual_svg code-training-and-reasoning/fig-02-sentiment %}
图 2｜从评论里读出情感，和在生成时把一个分量固定为 +1 或 −1，是两次不同的实验。下方英文摘自论文表 5 的实际生成样本。按 Radford 等人的实验重绘。<a href="#ref-3">[3]</a>
{% endvisual_svg %}

一条抱怨电池续航的评论，末尾接“以后还会再买”的机会很小。前文的态度能帮模型猜后文，标签可以等到检验时再给。研究者在生成评论时把那个分量固定为正值或负值，语气也跟着偏向相应一边。这个例子把时间线往回拨了两个月：从续写学到能拿去做另一件事的表示，循环网络就已经做到了。<sup class="cite"><a href="#ref-3">[3]</a></sup>

## 二、要猜下一个词，得记住什么

换回仓库。补 `for order in orders` 的行尾，熟悉 Python 的语法大概就能猜到冒号。接在 `remaining -=` 后面的变量名，要从前文找。到了日志里“第三笔订单后余货为 __”，读懂句子和变量名都还不够。这三处都用同一种方式计分，难处却落在不同地方。图 3 可以逐笔展开，看看每格的答案由哪条规则决定。

{% raw %}
<link rel="stylesheet" href="/2026/11/27/code-training-and-reasoning/interactive/controls.css">
<script defer src="/2026/11/27/code-training-and-reasoning/interactive/controls.js"></script>
<figure class="v-figure transfer-widget" id="trace-next-token" data-transfer-widget="trace"><p data-fallback>起始 6 件。申请 4 件后剩 2 件；下一笔要 5 件，只剩 2 件，跳过；最后申请 2 件，余量归零。逐笔记录是 [2, 2, 0]。</p><figcaption class="v-caption">图 3｜依次填入每笔订单处理后的余量，再看哪个条件约束了当前的答案。候选数字由作者选取，未使用模型打分。</figcaption></figure>
{% endraw %}

预训练时，答案就是语料里已有的内容。把一段语料切成 token，记第 $t$ 个为 $x_t$。模型根据此前的真实前文，为词表里的每个候选分配概率。实际出现的 token 分到的概率越小，损失越大。对 $T$ 个位置取平均，可以写成

$$
L(\theta)=-\frac{1}{T}\sum_{t=1}^{T}\log p_\theta(x_t\mid x_{<t}).
$$

“猜得更准”在这里有个具体意思：模型给真实 token 分到了更高的概率，哪怕它暂时还排不到第一。公式没要求模型用哪种办法得到这个数。常见搭配能猜中不少词，有时却得记住一句话提到了哪座城市，或算出上一笔订单有没有成交。同一句“这一笔处理完还剩”，可能接 2，也可能接 0，区别藏在前面那几笔账里。

我们可以写一个程序，显式留出一个变量存余量。神经网络学到的线索则可能分散在许多激活分量里。训练使某些输入差异在内部变得可辨认，例如事情已经办成，还是条件不够、原状保留。这样的内部编码叫作表示。从样本中学出能区分这些情况的特征，就是特征学习。换了数字、换了表述仍能答对，才有理由谈它在这些新例子上的泛化。只看一次正确续写，很难分辨模型用了哪条线索。

黑白棋给了研究者一个少见的便利：每读一手棋，都能算出此时整块棋盘的正确答案。Li 等人训练 Othello-GPT 时只给落子记录，让它预测下一手，随后冻结模型，另外训练一个小网络，从它的中间激活读出指定格子是黑、白还是空。这个小网络叫探针。用带非线性的小网络作探针，研究者能从这些激活里相当准确地还原盘面。再沿探针指示的方向改动激活，使探针把某个格子读成另一种颜色，模型给下一手分配的概率也会向修改后盘面的合法走法移动。<sup class="cite"><a href="#ref-4">[4]</a></sup>

{% visual_svg code-training-and-reasoning/fig-04-othello %}
图 4｜黑方在 C4 落子后，白方有哪些选择？示例棋局用来说明探针要读出什么，盘面按规则计算。论文另用干预实验检验模型选下一手时是否用到这类信息。<a href="#ref-4">[4]</a>
{% endvisual_svg %}

从激活里读出一项信息，和改动这项信息后让预测跟着变，是两种强度不同的证据。黑白棋有固定棋规，还允许研究者为改动后的棋盘重新列出合法走法。等到面对一份合同、一段程序或者日常对话，就很难找到这样一张可供逐格核对的标准棋盘了。

## 三、Transformer 让哪些计算能同时开工

既然循环网络也能练习续写，Transformer 让哪些计算变得容易了？2017 年的原版也是一台编码器—解码器翻译模型。它的解码器仍然根据源句和已知的译文前缀预测下一项，变化在于每一步内部怎样取数。后来，GPT 一类的模型把题目和答案放进同一条序列，沿用了因果解码的方式。BERT 同样用 Transformer，却会看左右文来补被遮住的词。用什么结构计算，和拿哪些位置来训练，是两件事。<sup class="cite"><a href="#ref-5">[5]</a></sup><sup class="cite"><a href="#ref-15">[15]</a></sup><sup class="cite"><a href="#ref-19">[19]</a></sup>

假设一段训练文本有四个位置。循环神经网络（RNN）在位置 2 的状态要用到位置 1 刚算出的状态，位置 3 又要等位置 2。LSTM 的门控能让前面的信息保留更久，这条逐位置递推仍然存在。可以把多条句子凑成一批，但在同一条句子里，多给几个计算单元，也不能提前得到第 3 步缺的那个状态。<sup class="cite"><a href="#ref-5">[5]</a></sup>

换成因果自注意力，先把上一层的四个位置摆成四行。每一行都从**上一层**取数：第 1 行只能看自己，第 4 行可以取前面三行和自己。等上一层就绪，第 4 行不用等本层第 3 行输出才开始算。训练文本本来就已知。算第二笔后的余量时，可以喂给模型账本上第一笔的真实记录，无须等模型自己填。把目标错开一位，再用因果掩码挡住未来位置，一次前向计算就能同时给许多位置打分。两处相隔很远的词，在循环网络里要经过一连串中间状态传话，在一层全注意力里就有一条直接连接。各层仍要依次算。图 5 只画解码器内部的依赖。<sup class="cite"><a href="#ref-5">[5]</a></sup>

{% visual_svg code-training-and-reasoning/fig-05-dependencies %}
图 5｜四个位置、一层计算。循环边连接同一层的相邻位置，因果注意力的连线来自上一层已经就绪的位置。图与下方逐步演示都只表示依赖关系，不用格数估算运行时间。<a href="#ref-5">[5]</a>
{% endvisual_svg %}

{% raw %}
<div class="transfer-widget tr-schedule" id="trace-schedule" data-transfer-widget="schedule"><p data-fallback>把四个输入位置都准备好。RNN 的四个输出要沿隐藏状态依次求出；一层因果自注意力的四行可以同时求值，每行仍只能读取本位置和它左边的输入。</p></div>
{% endraw %}

落到 GPU 上，区别体现在送进去的矩阵形状。若每个位置有 $d$ 个特征，整段有 $T$ 个位置，一次线性投影就可以把 $T\times d$ 的输入矩阵乘上同一块权重。加速器能把这些行切成小块，分给许多乘加单元，一块权重装进片上存储后还能给多行复用。这与[矩阵乘法那篇](/2026/11/03/gemm-languages-to-architecture/)讨论的分块是同一件事。循环网络也做矩阵乘法，额外的困难是同一条序列里，有些本可凑成大矩阵的行还没有算出来。

让每个位置都能直接读到前文，也带来了新的成本。标准全注意力在长为 $T$ 的序列上，要处理的成对位置数量按 $T^2$ 增长。即使算术单元足够多，把中间的分数矩阵写回显存再读出来也可能很慢。FlashAttention 通过分块，在片上累积结果，省掉完整分数矩阵的显存读写。同样的层，能在多长的序列上训练、每秒读多少数据，还取决于内核实现、显存和卡间通信。优化器还得选好每次更新的步长，让长时间的训练保持稳定。语料若反复出现同一批样板，再高的吞吐也只是在重复练习。<sup class="cite"><a href="#ref-5">[5]</a></sup><sup class="cite"><a href="#ref-6">[6]</a></sup>

推理时先读完题目。模型给下一项输出分配概率，解码策略从中选出一项，再把选中的 token 接回前文。假如它写了“第二笔不够，跳过”，这句话就成了下一步可用的信息。要是它误写成“发了 5 件”，后面的计算也可能沿着错账走。历史的键和值可以缓存，下一步仍要等本轮解码选定 token。这就是[推理时读题与逐词作答](/2026/11/08/llm-inference-from-token-to-cluster/)给 GPU 的两种工作量。读题可以整段处理，自己写出的答案则逐步回流。

## 四、一笔跳过的订单怎样帮到另一道题

现在把账本换成训练语料里的程序。假如模型在这类前文后面反复练习预测输出值，它多学到的一点东西，有没有可能带回那道文字题？

```python
remaining = 6
for order in [4, 5, 2]:
    if order <= remaining:
        remaining -= order
print(remaining)
```

最有意思的是程序里没写出来的那一步。读到 5 时，条件不成立，程序直接回到循环开头，`remaining` 仍为 2。题目里的“跳过”两个字承担了这个隐含分支。用图 6 的记号，$b$ 是处理前的余量，$q$ 是本单需求。若 $q\le b$，新余量 $b'=b-q$，否则 $b'=b$。三种写法都要求分清“这一步读了一个新数”和“这一步改变了余额”。把订单改成几组想要一起入场的观众，票数和人数都可以换，这个区别还在。

{% visual_svg code-training-and-reasoning/fig-06-stock %}
图 6｜代码中的条件、数学习题的分段规则和文字里的“给齐才发货”，沿同一笔订单对齐。余量依次为 2、2、0。原创概念示意，这里对齐的是三种描述的解法，模型的隐藏激活未经测量。
{% endvisual_svg %}

程序反复写出这类依赖。变量名把赋值和读取连起来，条件决定哪次赋值生效，循环把同一条规则用在不同输入上。递归还要跟踪哪一层的返回值交给了谁。如果训练让网络更容易把旧值留到需要的位置，代码和文字都可能用上这个特征。只学会缩进、冒号和常见变量名，补全 Python 照样可能进步，库存题却还卡在同一笔账上。

把“有帮助”缩小到一次参数更新，可以算得更确切些。在同一组参数 $\theta$ 上，取一批代码算出预测损失的梯度 $g_c$，再用一批数学题的解答算出另一个梯度 $g_m$。评分公式相同，两批前文提供的训练信号却可能把同一套权重往不同方向推。梯度指向各自损失上升最快的方向。先只用代码，沿相反方向走一小步，步长为 $\eta>0$。数学损失会怎样变？

$$
\theta'=\theta-\eta g_c,\qquad
L_m(\theta')-L_m(\theta)\approx -\eta\, g_m^\mathsf{T}g_c .
$$

右边的内积，就是代码梯度在数学梯度方向上有多大分量，再乘上数学梯度的长度。图 7 固定两根梯度的长度，只转动夹角。夹角小于直角时，沿代码的下降方向走，数学损失在一阶近似下也下降；越过直角，它反而上升。这种方向的一致程度叫梯度对齐。多任务训练会遇到梯度冲突，也确实有研究用类似的内积在小模型上估计不同语料应占多少采样权重。<sup class="cite"><a href="#ref-7">[7]</a></sup><sup class="cite"><a href="#ref-8">[8]</a></sup>

{% raw %}
<figure class="v-figure transfer-widget" id="trace-gradients" data-transfer-widget="gradients"><div data-fallback><svg viewBox="0 0 240 110" role="img" aria-label="60 度的两个梯度，短箭头为沿负代码梯度的更新" style="max-width:320px"><g fill="none" stroke-width="3"><path stroke="var(--chart-blue,#467ab8)" d="M75 85H155m-8-5 8 5-8 5"/><path stroke="var(--chart-red,#ab574a)" stroke-dasharray="5 3" d="M75 85l40-69m-9 5 9-5 0 10"/><path stroke="var(--chart-teal,#367e75)" d="M75 85H55m5-4-5 4 5 4"/></g><g fill="currentColor" font-size="12"><text x="160" y="90">g_code</text><text x="121" y="19">g_math</text><text x="14" y="90">−ηg</text></g></svg><p>单位梯度夹角为 60°，内积为 +0.5。取 η = 0.25，数学损失的一阶变化约为 −0.125。夹角换成 120°，内积与损失变化的符号都会翻转。</p></div><figcaption class="v-caption">图 7｜两根梯度都是单位向量。短箭头是沿代码梯度的反方向走四分之一单位的参数更新。转动虚线的数学梯度，可以看到同一步更新在它方向上的投影。原创二维示意，只计算一阶项。</figcaption></figure>
{% endraw %}

图 7 假设损失在当前参数附近光滑，步长足够小。夹角恰为直角，只意味着一阶项为零。换一批样本，方向也可能变。要是优化器用了动量或按分量调整步长，展开式里应代入实际走出的一步。**正迁移**和**负迁移**最终得靠对照实验判断，分别指目标任务做得更好或更差。一次更新让正确 token 多分到一点概率，还不能告诉我们整道题会不会做对。

## 五、多读代码的时候，少读了什么

同样练的是续写，训练语料里调高代码比重，模型遇到的下一题就变了。Petty 等人用约 3.74 亿参数的模型做了两种对照，每种配方各跑五个随机种子。在 1320 亿自然语言 token 里，把一半换成代码，总量不变。也可以保留全部 1320 亿文本，再追加同样多的代码。这样训练量翻倍，所以作者还做了一组同样长的纯文本训练。<sup class="cite"><a href="#ref-9">[9]</a></sup>

{% visual_svg code-training-and-reasoning/fig-08-mixtures %}
图 8｜横条按训练 token 数等比例绘制，B 表示十亿。先比较同为 132B 的两条，再看同为 264B 的两条。跨长度比较时，内容和训练量可能一起变化。根据 Petty 等人图 1 的 50% 代码条件重绘。<a href="#ref-9">[9]</a>
{% endvisual_svg %}

他们考了一类很贴近开头直觉的题。模型先经任务微调，练习把英语句子译成逻辑表达式，再用见过的词和结构拼出训练时没见过的组合，要求整个表达式写对。在简化输出格式的 COGS-vf 上，把代码追加到文本之后，相比读同样多 token 的纯文本组，模型更能处理一些没见过的结构组合。作者甚至检查了输出括号能否配平，仅靠少写几个错括号，解释不了总体趋势。换一道同样可以描述为“语言推理”的题，让模型把主动句变成被动句，更多代码反倒总体上拉低了泛化表现。连保留了全部文本、额外加入代码的那组也出现了这种下降。多位数算术选择题在固定总量组里也没有一路涨，曲线在约 40% 到 50% 代码附近见顶。<sup class="cite"><a href="#ref-9">[9]</a></sup>

另一组实验能直接看到这笔交换的得失。Aryabumi 等人取 4.7 亿参数的模型，两组各读 4000 亿 token。为了排除最后一段训练又调配语料的影响，图 9 只取论文表 2 进入这一阶段前的两行。把一半文本换成代码，自然语言推理任务的平均准确率从 49.0% 升到 51.8%，增加 2.8 个百分点。知识问答要求生成的答案与参考答案精确匹配，平均分从 9.5% 降到 8.1%。代码题看一次生成的解答能否通过测试，平均 pass@1 从 0.4% 升到 9.0%。<sup class="cite"><a href="#ref-10">[10]</a></sup>

{% visual_svg code-training-and-reasoning/fig-09-transfer %}
图 9｜两组都训练到 400B token。每一行只比较本行的两种配方，差值为百分点。三行的评分方法不同。按 Aryabumi 等人表 2 的预训练行重绘。<a href="#ref-10">[10]</a> · <a href="/2026/11/27/code-training-and-reasoning/reproduce/aryabumi-table2.json">原始表值</a> · <a href="/2026/11/27/code-training-and-reasoning/reproduce/render-transfer.mjs">绘图脚本</a>
{% endvisual_svg %}

推理涨、知识跌，可以有一个很朴素的原因：程序里反复出现条件和依赖，但挤掉的文章可能恰好写了某个人的出生地。图 9 能告诉我们两种配方各自训练出了什么，不能倒过来查明某道错题对应哪篇被换掉的文章。它的“自然语言推理”也是一组特定的评测，不能把 2.8 个百分点记在数学成绩上。

那么，把代码改成写明中间步骤的文字，还有没有用？Waheed 等人固定指令问题，改写用于微调的答案，有的保留可运行程序，有的给伪代码或用文字编码的流程图，还有的故意扰乱程序的结构或注释。他们用五个模型家族、八种规模做指令微调。某些任务用伪代码或流程图就能取得与原始代码相当的结果。有些程序即使配了误导性的注释，只要表面规律还在，部分测试成绩仍能接近原始代码组。这里相同条数的答案可以有不同 token 数。实验回答的是微调时答案写成什么样合适，要决定从零预训练时的代码比例，还得计入另一笔预算。<sup class="cite"><a href="#ref-11">[11]</a></sup>

Zhao 等人从另一个方向检验了这个猜想。他们在固定总 token 数的预训练里拿掉独立代码语料，按比例从其余类别补足。夹有代码片段的问题描述、解释和推导仍留在训练集里。图 10 里，从空心标记的去代码组读到实心标记的完整配方。十亿参数的稠密模型在编程题 HumanEval 上从 2.44 分升到 24.39 分。看两份数学卷子，MATH500 的分数向左移，OlympiadBench 的却向右移。两项结果都是真实测量，取其中一项代表“数学能力”，就会得到相反的答案。<sup class="cite"><a href="#ref-12">[12]</a></sup>

{% visual_svg code-training-and-reasoning/fig-10-math %}
图 10｜同一篇论文、同一规模的两个预训练模型。去掉独立程序后，其余语料会补足训练预算。读每一行的两个点，可以看到完整配方使哪些题的分数上升、哪些下降。按 Zhao 等人附录 A.7 的 1B 稠密模型原始表值重绘。<a href="#ref-12">[12]</a>
{% endvisual_svg %}

作者又固定数学语料预算，用那些把推导步骤和符号关系写得更完整的解答替换一部分普通数学文本。部分复杂数学任务受益，GSM8K 等较简单的应用题却可能吃亏。入选的解答通常也更长，内容和形式仍缠在一起。<sup class="cite"><a href="#ref-12">[12]</a></sup>

给各种语料用同一项损失打分，模型就有机会在同一套参数里保留共用的东西。至于哪种东西学得更多，还得看它在语料里遇到了什么。程序里多出来的是反复出现的状态更新，还是格式固定的样板？被换掉的是闲聊，还是一道把每步推导都写清楚的例题？这两处都会改变它以后能续写什么。

<span id="六、为什么许多成绩仍能一起变好" class="ref-anchor"></span>

## 六、续写更准，整道题就会做对吗

在固定的训练预算里，代码和文本得争位置。如果训练预算也变大，模型就有机会多见一些程序，也多见一些解释。来看这时所说的“更准”，究竟量的是哪件事。

图 9 比的是同样多的 token 换一种配方。还可以接着训练同一套权重，把更多数据喂给同样大小的网络，或从头训练一个更宽、更深的网络。Kaplan 等人发现，在考察的规模和相应资源条件下，留出文本上的平均交叉熵随参数量、数据量或训练算力的变化，可以用幂律拟合。图 11 的纵轴对应的是语言模型损失，和一道题有没有答对隔着一步。<sup class="cite"><a href="#ref-13">[13]</a></sup>

{% visual_svg code-training-and-reasoning/fig-11-scaling %}
图 11｜横轴是训练计算量相对起点的倍数，纵轴是扣掉一个假定损失下限后的相对值。两轴均为对数刻度。示例取指数 −¼，算力乘 16 时纵轴减半。这个指数为讲解而选，图上没有实测数据。幂律的经验依据见 <a href="#ref-13">[13]</a>。
{% endvisual_svg %}

同样多的算力也有不同花法。Hoffmann 等人的 Chinchilla 有 700 亿参数，约为 Gopher 的四分之一，读了约四倍的训练数据。在相近的训练预算下，它在不少下游评测上超过了 Gopher。如果相似的条件关系出现在更多程序、例题和解释里，增加模型容量和训练数据就可能让几类题一起受益。到底能不能涨分，还得看它原来错在什么地方。<sup class="cite"><a href="#ref-14">[14]</a></sup>

拿只有两个选项的题来说，正确选项的概率从 30% 涨到 45%，预测损失已经下降。要是仍选概率更高的那个，整题得分还是零。在开放问答里，“剩 0 件”和“已经发完”也都可以答对，虽然它们的第一个 token 不同。GPT-3 的 ANLI 评测也提醒了我这一点。模型得在“能推出”“矛盾”和“无法确定”中选一个。较小的模型多在随机猜测的约 33% 附近，最大的 1750 亿参数模型才在第三轮拉开了一些距离。平均损失可以平滑地降，过了评测的判分线，才会多对一道题。<sup class="cite"><a href="#ref-15">[15]</a></sup>

同样一套权重，也可以换个答法。让模型直接交余量，它得在写出第一个答案 token 之前把账算好。让它先写“第一笔剩 2 件，第二笔跳过”，这些中间结果就成了后面可读的前文。给模型几道写了中间步骤的示范，确实能提高它在一些算术和符号推理评测上的成绩。此时训练已经结束，变的是这一次作答能用的计算。<sup class="cite"><a href="#ref-17">[17]</a></sup>

这也是我理解访谈里“唯一”二字的方式。对自回归语言模型，预测下一个 token 是预训练的共同目标，也是生成时反复使用的操作。我们希望得到怎样的一整段回答，还可以另外给信号。比如用人对完整回答的排序训练一个奖励模型，再用它给新回答打分，通过强化学习更新语言模型。更新改变的仍是逐步生成时的输出概率，给训练指方向的已经是整段回答的得分。<sup class="cite"><a href="#ref-18">[18]</a></sup>

回到那 6 件货。把“不够就**跳过**”换成“不够就**停止**”，三个数字一个没动，第三位顾客却再也轮不到了。要填的最后一个数从 0 变成 2。如果读代码真教会了模型怎样跟踪一笔没成交的订单，换个场景、改条规则以后，它还应该能填对。

## 参考资料

1. <span id="ref-1" class="ref-anchor"></span>Dai & Le. [Semi-supervised Sequence Learning](https://research.google/pubs/semi-supervised-sequence-learning/). NeurIPS 2015。循环网络的无监督预训练与分类迁移。
2. <span id="ref-2" class="ref-anchor"></span>Luong et al. [Multi-task Sequence to Sequence Learning](https://arxiv.org/abs/1511.06114). ICLR 2016。不同任务共用编码器的设计。
3. <span id="ref-3" class="ref-anchor"></span>Radford, Jozefowicz & Sutskever. [Learning to Generate Reviews and Discovering Sentiment](https://arxiv.org/pdf/1704.01444). 2017 年技术预印本。IMDb 阈值分类与受控生成，表 2、5。
4. <span id="ref-4" class="ref-anchor"></span>Li et al. [Emergent World Representations: Exploring a Sequence Model Trained on a Synthetic Task](https://arxiv.org/abs/2210.13382). ICLR 2023。黑白棋探针与激活干预，第 3、4 节。
5. <span id="ref-5" class="ref-anchor"></span>Vaswani et al. [Attention Is All You Need](https://arxiv.org/abs/1706.03762). NeurIPS 2017。因果遮蔽及各层的序列依赖，第 3、4 节、表 1。
6. <span id="ref-6" class="ref-anchor"></span>Dao et al. [FlashAttention: Fast and Memory-Efficient Exact Attention with IO-Awareness](https://arxiv.org/abs/2205.14135). NeurIPS 2022。片上分块与显存访问。
7. <span id="ref-7" class="ref-anchor"></span>Yu et al. [Gradient Surgery for Multi-Task Learning](https://arxiv.org/abs/2001.06782). NeurIPS 2020。共享参数上的梯度冲突。
8. <span id="ref-8" class="ref-anchor"></span>Fan, Pagliardini & Jaggi. [DoGE: Domain Reweighting with Generalization Estimation](https://proceedings.mlr.press/v235/fan24e.html). ICML 2024。在代理模型上估计跨域更新的效果。
9. <span id="ref-9" class="ref-anchor"></span>Petty, van Steenkiste & Linzen. [How Does Code Pretraining Affect Language Model Task Performance?](https://research.google/pubs/how-does-code-pretraining-affect-language-model-task-performance/). TMLR 2025。图 1 的两类预算对照，图 2–5 的泛化和算术评测。
10. <span id="ref-10" class="ref-anchor"></span>Aryabumi et al. [To Code, or Not To Code? Exploring Impact of Code in Pre-training](https://proceedings.iclr.cc/paper_files/paper/2025/file/c513d1786f85531fac7050947736265f-Paper-Conference.pdf#page=25). ICLR 2025。图 9 取自表 2 的 TEXT-ONLY、BALANCED-ONLY 预训练行。
11. <span id="ref-11" class="ref-anchor"></span>Waheed et al. [On Code-Induced Reasoning in LLMs](https://proceedings.iclr.cc/paper_files/paper/2026/hash/f39cbd56877419229aef90dbe463c182-Abstract-Conference.html). ICLR 2026。指令数据的扰动、伪代码与流程图。
12. <span id="ref-12" class="ref-anchor"></span>Zhao et al. [What Really Improves Mathematical Reasoning: Structured Reasoning Signals Beyond Pure Code](https://proceedings.mlr.press/v306/zhao26k.html). ICML 2026。语料移除与结构化解答重采样。[附录 A.7 的逐项结果](https://arxiv.org/html/2605.19762v1#A1.SS7)。
13. <span id="ref-13" class="ref-anchor"></span>Kaplan et al. [Scaling Laws for Neural Language Models](https://arxiv.org/abs/2001.08361). 2020 年预印本。语言模型损失随规模变化的经验拟合。
14. <span id="ref-14" class="ref-anchor"></span>Hoffmann et al. [Training Compute-Optimal Large Language Models](https://arxiv.org/abs/2203.15556). NeurIPS 2022。固定计算量时，参数和训练数据的分配。
15. <span id="ref-15" class="ref-anchor"></span>Brown et al. [Language Models are Few-Shot Learners](https://arxiv.org/abs/2005.14165). NeurIPS 2020。上下文少样本评测及第 3.8 节的自然语言推断结果。
16. <span id="ref-16" class="ref-anchor"></span>Sutskever, Vinyals & Le. [Sequence to Sequence Learning with Neural Networks](https://arxiv.org/abs/1409.3215). NeurIPS 2014。第 2 节的条件语言模型与第 3.2 节的逐词解码。
17. <span id="ref-17" class="ref-anchor"></span>Wei et al. [Chain-of-Thought Prompting Elicits Reasoning in Large Language Models](https://arxiv.org/abs/2201.11903). NeurIPS 2022。用解题示例提示模型生成中间步骤。
18. <span id="ref-18" class="ref-anchor"></span>Ouyang et al. [Training Language Models to Follow Instructions with Human Feedback](https://arxiv.org/abs/2203.02155). NeurIPS 2022。偏好排序、奖励模型与强化学习。
19. <span id="ref-19" class="ref-anchor"></span>Devlin et al. [BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding](https://aclanthology.org/N19-1423/). NAACL 2019。双向的掩码语言建模。
