import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  InputAdornment,
  MenuItem,
  Popover,
  Select,
  TextField,
  Tooltip
} from "@mui/material";
import {
  Columns3,
  Database,
  Filter,
  Grid2X2,
  RefreshCw,
  Search,
  SlidersHorizontal
} from "lucide-react";
import { DataGrid, GridColDef, GridColumnVisibilityModel, GridSortModel } from "@mui/x-data-grid";
import type { DatabaseNode, TableDataResponse, TableNode } from "../shared/types";
import { fetchMetadata, fetchTableData } from "./api";

const pageSizeOptions = [50, 100, 200, 500];

const Description = ({ text }: { text?: string | null }) =>
  text ? <div className="muted-label">{text}</div> : null;

const NodeText = ({ name, description }: { name: string; description?: string | null }) => (
  <Tooltip
    arrow
    enterDelay={450}
    placement="right"
    title={
      <div className="node-tooltip">
        <strong>{name}</strong>
        {description ? <span>{description}</span> : null}
      </div>
    }
  >
    <span className="node-text">
      <strong>{name}</strong>
      <Description text={description} />
    </span>
  </Tooltip>
);

const HeaderCell = ({ name, description }: { name: string; description?: string | null }) => (
  <div className="column-header">
    <span>{name}</span>
    <Description text={description} />
  </div>
);

export const App = () => {
  const [databases, setDatabases] = useState<DatabaseNode[]>([]);
  const [sidebarWidth, setSidebarWidth] = useState(354);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["order_data", "device_management"]));
  const [activeTable, setActiveTable] = useState<TableNode | null>(null);
  const [metadataSearch, setMetadataSearch] = useState("");
  const [dataSearch, setDataSearch] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(100);
  const [sortModel, setSortModel] = useState<GridSortModel>([]);
  const [columnVisibilityModel, setColumnVisibilityModel] = useState<GridColumnVisibilityModel>({});
  const [columnsAnchor, setColumnsAnchor] = useState<HTMLButtonElement | null>(null);
  const [filterAnchor, setFilterAnchor] = useState<HTMLButtonElement | null>(null);
  const [filterColumn, setFilterColumn] = useState("");
  const [filterOperator, setFilterOperator] = useState("contains");
  const [filterValue, setFilterValue] = useState("");
  const [filters, setFilters] = useState<Array<{ column: string; operator: string; value?: string }>>([]);
  const [tableData, setTableData] = useState<TableDataResponse | null>(null);
  const [loadingMetadata, setLoadingMetadata] = useState(true);
  const [loadingRows, setLoadingRows] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMetadata = async () => {
    setLoadingMetadata(true);
    setError(null);
    try {
      const result = await fetchMetadata();
      setDatabases(result.databases);
      const tables = result.databases.flatMap((database) => database.tables);
      const preferredTable = tables.find((table) => table.name === "order_items");
      if (preferredTable) {
        setActiveTable((current) => current ?? preferredTable);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load metadata.");
    } finally {
      setLoadingMetadata(false);
    }
  };

  useEffect(() => {
    void loadMetadata();
  }, []);

  useEffect(() => {
    if (!isResizingSidebar) {
      return;
    }

    const handleMouseMove = (event: MouseEvent) => {
      const nextWidth = Math.min(Math.max(event.clientX, 280), 620);
      setSidebarWidth(nextWidth);
    };

    const handleMouseUp = () => {
      setIsResizingSidebar(false);
    };

    document.body.classList.add("is-resizing-sidebar");
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.body.classList.remove("is-resizing-sidebar");
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizingSidebar]);

  const loadRows = async () => {
    if (!activeTable) {
      return;
    }
    setLoadingRows(true);
    setError(null);
    try {
      const primarySort = sortModel[0];
      const result = await fetchTableData({
        database: activeTable.database,
        schema: activeTable.schema,
        table: activeTable.name,
        page: page + 1,
        pageSize,
        search: dataSearch,
        sortColumn: primarySort?.field,
        sortDirection: primarySort?.sort ?? undefined,
        filters
      });
      setTableData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load table data.");
    } finally {
      setLoadingRows(false);
    }
  };

  useEffect(() => {
    void loadRows();
  }, [activeTable, page, pageSize, sortModel, filters]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setPage(0);
      void loadRows();
    }, 280);
    return () => window.clearTimeout(handle);
  }, [dataSearch]);

  const filteredDatabases = useMemo(() => {
    const term = metadataSearch.trim().toLowerCase();
    if (!term) {
      return databases;
    }
    return databases
      .map((database) => ({
        ...database,
        tables: database.tables.filter(
          (table) =>
            table.name.toLowerCase().includes(term) ||
            table.description?.toLowerCase().includes(term) ||
            database.name.toLowerCase().includes(term) ||
            database.description?.toLowerCase().includes(term)
        )
      }))
      .filter((database) => database.name.toLowerCase().includes(term) || database.tables.length > 0);
  }, [databases, metadataSearch]);

  const columns: GridColDef[] = useMemo(() => {
    if (!tableData) {
      return [];
    }

    return tableData.columns.map((column) => ({
      field: column.name,
      minWidth: 130,
      flex: 1,
      sortable: true,
      renderHeader: () => <HeaderCell name={column.name} description={column.description} />
    }));
  }, [tableData]);

  useEffect(() => {
    setFilterColumn((current) => current || tableData?.columns[0]?.name || "");
  }, [tableData]);

  return (
    <div className="app-shell" style={{ gridTemplateColumns: `${sidebarWidth}px 8px minmax(0, 1fr)` }}>
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">
            <Database size={30} />
          </div>
          <div>
            <h1>SQL Server Viewer</h1>
            <span>只读 · 数据浏览</span>
          </div>
        </div>

        <TextField
          className="sidebar-search"
          size="small"
          placeholder="搜索数据库或表..."
          value={metadataSearch}
          onChange={(event) => setMetadataSearch(event.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search size={18} />
              </InputAdornment>
            )
          }}
        />

        <div className="tree">
          {loadingMetadata ? (
            <div className="loading-inline">
              <CircularProgress size={18} /> 加载元数据...
            </div>
          ) : (
            filteredDatabases.map((database) => {
              const isOpen = expanded.has(database.name);
              return (
                <div className="tree-section" key={database.name}>
                  <button
                    className="database-node"
                    onClick={() => {
                      setExpanded((current) => {
                        const next = new Set(current);
                        if (next.has(database.name)) {
                          next.delete(database.name);
                        } else {
                          next.add(database.name);
                        }
                        return next;
                      });
                    }}
                  >
                    <span className="chevron">{isOpen ? "⌄" : "›"}</span>
                    <Database size={21} />
                    <NodeText name={database.name} description={database.description} />
                    <span className="count-label">{database.tableCount}</span>
                  </button>

                  {isOpen && (
                    <div className="table-list">
                      {database.tables.map((table) => {
                        const active =
                          activeTable?.database === table.database && activeTable?.name === table.name;
                        return (
                          <button
                            key={`${table.database}.${table.schema}.${table.name}`}
                            className={`table-node ${active ? "active" : ""}`}
                            onClick={() => {
                              setActiveTable(table);
                              setPage(0);
                            }}
                          >
                            <Grid2X2 size={21} />
                            <NodeText name={table.name} description={table.description} />
                            <span className="count-label">{table.rowCountLabel}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </aside>

      <div
        aria-label="调整左侧导航宽度"
        className="sidebar-resizer"
        role="separator"
        title="拖动调整左侧导航宽度"
        onMouseDown={(event) => {
          event.preventDefault();
          setIsResizingSidebar(true);
        }}
      />

      <main className="content">
        <header className="topbar">
          <div className="breadcrumb">
            <Database size={20} />
            <span>{activeTable?.database ?? "database"}</span>
            <span>›</span>
            <strong>{activeTable?.name ?? "table"}</strong>
          </div>
          <div className="connection-status">
            <Database size={20} />
            <div>
              <strong>本地 SQL Server Viewer</strong>
              <span>上次刷新：{new Date().toLocaleString("zh-CN", { hour12: false })}</span>
            </div>
            <div className="avatar">U</div>
          </div>
        </header>

        <section className="title-row">
          <Grid2X2 className="title-icon" size={33} />
          <div>
            <h2>{activeTable?.name ?? "请选择表"}</h2>
            <Description text={activeTable?.description ?? tableData?.tableDescription} />
          </div>
        </section>

        <section className="toolbar">
          <TextField
            className="data-search"
            size="small"
            placeholder="搜索数据..."
            value={dataSearch}
            onChange={(event) => setDataSearch(event.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={19} />
                </InputAdornment>
              )
            }}
          />
          <Tooltip title="字段筛选">
            <Button variant="outlined" startIcon={<Filter size={19} />} onClick={(event) => setFilterAnchor(event.currentTarget)}>
              筛选
            </Button>
          </Tooltip>
          <Tooltip title="点击列头可排序">
            <Button variant="outlined" startIcon={<SlidersHorizontal size={19} />}>
              排序
            </Button>
          </Tooltip>
          <Tooltip title="列显示、隐藏和列宽可在表格内调整">
            <Button variant="outlined" startIcon={<Columns3 size={19} />} onClick={(event) => setColumnsAnchor(event.currentTarget)}>
              列设置
            </Button>
          </Tooltip>
          <Tooltip title="刷新">
            <Button variant="outlined" startIcon={<RefreshCw size={19} />} onClick={() => void loadRows()}>
              刷新
            </Button>
          </Tooltip>
          <Box flex={1} />
          <div className="row-count">共 {tableData?.rowCount.toLocaleString("zh-CN") ?? 0} 行</div>
        </section>

        {error && <div className="error-bar">{error}</div>}

        <section className="grid-panel">
          <DataGrid
            rows={(tableData?.rows ?? []).map((row, index) => ({ ...row, __grid_id: `${page}-${index}` }))}
            columns={columns}
            getRowId={(row) => row.__grid_id}
            loading={loadingRows}
            rowCount={tableData?.rowCount ?? 0}
            paginationMode="server"
            sortingMode="server"
            paginationModel={{ page, pageSize }}
            onPaginationModelChange={(model) => {
              setPage(model.page);
              setPageSize(model.pageSize);
            }}
            pageSizeOptions={pageSizeOptions}
            sortModel={sortModel}
            columnVisibilityModel={columnVisibilityModel}
            onColumnVisibilityModelChange={setColumnVisibilityModel}
            onSortModelChange={(model) => {
              setSortModel(model);
              setPage(0);
            }}
            disableRowSelectionOnClick
            disableMultipleRowSelection
            density="standard"
            slots={{
              noRowsOverlay: () => <div className="no-rows">没有数据</div>
            }}
            sx={{
              border: 0,
              "& .MuiDataGrid-columnHeaders": {
                background: "#f8fbff"
              },
              "& .MuiDataGrid-columnHeader": {
                minHeight: "78px !important"
              },
              "& .MuiDataGrid-cell": {
                color: "#10213b"
              }
            }}
          />
        </section>

        <Popover
          open={Boolean(filterAnchor)}
          anchorEl={filterAnchor}
          onClose={() => setFilterAnchor(null)}
          anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        >
          <div className="popover-panel">
            <strong>字段筛选</strong>
            <Select size="small" value={filterColumn} onChange={(event) => setFilterColumn(event.target.value)}>
              {tableData?.columns.map((column) => (
                <MenuItem key={column.name} value={column.name}>
                  {column.name}
                </MenuItem>
              ))}
            </Select>
            <Select size="small" value={filterOperator} onChange={(event) => setFilterOperator(event.target.value)}>
              <MenuItem value="contains">包含</MenuItem>
              <MenuItem value="equals">等于</MenuItem>
              <MenuItem value="startsWith">开头是</MenuItem>
            </Select>
            <TextField
              size="small"
              placeholder="筛选值"
              value={filterValue}
              onChange={(event) => setFilterValue(event.target.value)}
            />
            <div className="popover-actions">
              <Button
                size="small"
                onClick={() => {
                  setFilters([]);
                  setFilterValue("");
                  setPage(0);
                  setFilterAnchor(null);
                }}
              >
                清除
              </Button>
              <Button
                size="small"
                variant="contained"
                onClick={() => {
                  if (filterColumn && filterValue) {
                    setFilters([{ column: filterColumn, operator: filterOperator, value: filterValue }]);
                    setPage(0);
                  }
                  setFilterAnchor(null);
                }}
              >
                应用
              </Button>
            </div>
          </div>
        </Popover>

        <Popover
          open={Boolean(columnsAnchor)}
          anchorEl={columnsAnchor}
          onClose={() => setColumnsAnchor(null)}
          anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        >
          <div className="popover-panel column-panel">
            <strong>列设置</strong>
            {tableData?.columns.map((column) => (
              <FormControlLabel
                key={column.name}
                control={
                  <Checkbox
                    checked={columnVisibilityModel[column.name] !== false}
                    onChange={(event) =>
                      setColumnVisibilityModel((current) => ({
                        ...current,
                        [column.name]: event.target.checked
                      }))
                    }
                  />
                }
                label={
                  <span>
                    {column.name}
                    {column.description ? <small>{column.description}</small> : null}
                  </span>
                }
              />
            ))}
          </div>
        </Popover>

        <footer className="footer">
          <span>SQL Server Viewer v0.1.0</span>
          <span>只读模式 · 安全连接 · 数据不落地</span>
        </footer>
      </main>
    </div>
  );
};
