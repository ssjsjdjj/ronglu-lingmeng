(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MosslightCharacters = factory();
})(typeof GameGlobal !== 'undefined' ? GameGlobal : globalThis, function () {
  return [
    { name: '栗团', species: '松鼠', file: 'lituan', skill: '松风横扫', desc: '清除冰晶最多的一整行', color: '#edb568', story: '把沿途的种子装进叶片挎包，总能找到下一盏路灯。' },
    { name: '露铃', species: '六角蝾螈', file: 'luling', skill: '露珠轻响', desc: '命中全部冰晶，无冰时清除中间一行', color: '#8bd9cc', story: '喜欢听溪水的声音，用轻轻摇晃的鳃瓣收集晨露。' },
    { name: '砾宝', species: '犰狳', file: 'libao', skill: '滚石开路', desc: '清除冰晶最多的 3×3 区域', color: '#e5a07c', story: '走得不快，却总能把挡住伙伴的小石头挪开。' },
    { name: '芽卷', species: '刺猬', file: 'yajuan', skill: '叶芽集合', desc: '清除数量最多的一种小兽', color: '#b9cf65', story: '背着一丛会换季的小叶子，擅长把散落的微光聚到一起。' },
    { name: '澜羽', species: '翠鸟', file: 'lanyu', skill: '双翼掠影', desc: '清除冰晶最多的两整列', color: '#77ade8', story: '把溪谷画在卷叶地图里，从高处替伙伴寻找道路。' },
    { name: '云鼾', species: '貘', file: 'yunhan', skill: '云梦十字', desc: '清除冰晶最多的一行与一列', color: '#c7a1d8', story: '走到哪里都带着一点困意，梦里的路却格外清楚。' }
  ];
});
