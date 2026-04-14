import { PuzzlePiece } from '@strapi/icons';
import pluginId from './pluginId';

const pluginName = 'Markdown Import';

export default {
  register(app: any) {
    app.addMenuLink({
      to: `/plugins/${pluginId}`,
      icon: PuzzlePiece,
      intlLabel: {
        id: `${pluginId}.plugin.name`,
        defaultMessage: 'Markdown 导入',
      },
      Component: () => import('./pages/HomePage'),
      permissions: [],
    });

    app.registerPlugin({
      id: pluginId,
      name: pluginName,
    });
  },
};
