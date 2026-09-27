function r(t){if(!t)return"—";const e=new Date(t);return Number.isNaN(e.getTime())?"—":new Intl.DateTimeFormat("zh-CN",{dateStyle:"medium",timeStyle:"short"}).format(e)}export{r as f};
