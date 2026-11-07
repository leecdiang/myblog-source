'use strict';
const path = require('path');
const fs = require('node:fs');
const {imageSize} = require('image-size');
const sections = [
  {id: 'technology', label: '技术与研究', names: ['Silicon & Circuits', '计算机体系结构']},
  {id: 'everyday', label: '日常与实践', names: ['Everyday Anatomy']},
  {id: 'photography', label: '影像与旅行', names: ['Visual Narrative']}
];
function sectionFor(post) {
  const names = post.categories.toArray().map(c => c.name);
  return sections.find(section => section.names.some(name => names.includes(name)))?.id || 'other';
}
hexo.extend.helper.register('studio_section', sectionFor);
hexo.extend.helper.register('studio_sections', function (posts) {
  const items = posts.toArray();
  const groups = sections.map(section => ({...section, count: items.filter(post => sectionFor(post) === section.id).length}));
  const other = items.filter(post => sectionFor(post) === 'other').length;
  if (other) groups.push({id: 'other', label: '其他', count: other});
  return groups.filter(group => group.count);
});
hexo.extend.helper.register('studio_photo_stories', function () {
  return this.site.posts.sort('date', -1).toArray().filter(post => post.image_width && post.categories.toArray().some(c => c.name === 'Visual Narrative')).map(post => {
    const match = post.content.match(/<img\b[^>]*(?:data-src|src)=["']([^"']+)["']/i);
    let cover = match ? match[1] : '/images/bg.jpg';
    if (!/^(?:\/|https?:|data:)/.test(cover)) cover = '/' + post.path + cover;
    let dimensions = {width: 1600, height: 1067};
    if (cover.startsWith('/') && !cover.startsWith('//')) {
      try { dimensions = imageSize(fs.readFileSync(path.join(hexo.public_dir, decodeURIComponent(cover)))); } catch {}
    }
    return {title: post.title, path: post.path, date: post.date, description: post.description || '', cover, width: dimensions.width, height: dimensions.height};
  });
});
