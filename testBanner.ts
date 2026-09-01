const banners = [
  { contentId: { contentType: 'drama' } },
  { contentId: { type: 'movie' } }
];
const tab = 'drama';
const filtered = banners.filter(b => {
  if (!b.contentId) return true;
  return (b.contentId as any).contentType === 'drama';
});
console.log(filtered);
