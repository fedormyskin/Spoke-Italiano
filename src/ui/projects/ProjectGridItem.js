import React, { Component } from "react";
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import styled from "styled-components";
import { showMenu } from "react-contextmenu";
import MenuButton from "../inputs/MenuButton";
import StylableContextMenuTrigger from "./StylableContextMenuTrigger";

function collectMenuProps({ project }) {
  return { project };
}

const StyledProjectGridItem = styled(Link)`
  display: flex;
  flex-direction: column;
  height: 220px;
  border-radius: 6px;
  background-color: ${props => props.theme.panel2};
  text-decoration: none;
  border: 1px solid transparent;

  &:hover {
    color: inherit;
    border-color: ${props => props.theme.selected};
  }
`;

const StyledContextMenuTrigger = styled(StylableContextMenuTrigger)`
  display: flex;
  flex-direction: column;
  flex: 1;
  border-top-left-radius: inherit;
  border-top-right-radius: inherit;
`;

const TitleContainer = styled.div`
  display: flex;
  height: 50px;
  align-items: center;
  padding: 0 16px;

  h3 {
    font-size: 16px;
  }

  button {
    margin-left: auto;
  }
`;

const ThumbnailContainer = styled.div`
  display: flex;
  flex: 1 0 auto;
  justify-content: center;
  align-items: stretch;
  background-color: ${props => props.theme.panel};
  overflow: hidden;
  border-top-left-radius: inherit;
  border-top-right-radius: inherit;
`;

const Thumbnail = styled.div`
  display: flex;
  flex: 1;
  background-size: cover;
  background-position: 50%;
  background-repeat: no-repeat;
  border-top-left-radius: inherit;
  border-top-right-radius: inherit;
  background-image: url(${props => props.src});
`;

export default class ProjectGridItem extends Component {
  static propTypes = {
    contextMenuId: PropTypes.string,
    project: PropTypes.object.isRequired
  };

  onShowMenu = event => {
    event.preventDefault();
    event.stopPropagation();

    const x = event.clientX || (event.touches && event.touches[0].pageX);
    const y = event.clientY || (event.touches && event.touches[0].pageY);
    showMenu({
      position: { x, y },
      target: event.currentTarget,
      id: this.props.contextMenuId,
      data: {
        project: this.props.project
      }
    });
  };

  render() {
    const { project, contextMenuId } = this.props;

    const content = (
      <>
        <ThumbnailContainer>{project.thumbnailUrl && <Thumbnail src={project.thumbnailUrl} />}</ThumbnailContainer>
        <TitleContainer>
          <h3>{project.name}</h3>
          {contextMenuId && <MenuButton onClick={this.onShowMenu} className="fas fa-ellipsis-v" />}
        </TitleContainer>
      </>
    );

    if (contextMenuId) {
      return (
        <StyledProjectGridItem to={project.url}>
          <StyledContextMenuTrigger id={contextMenuId} project={project} collect={collectMenuProps} holdToDisplay={-1}>
            {content}
          </StyledContextMenuTrigger>
        </StyledProjectGridItem>
      );
    } else {
      return <StyledProjectGridItem to={project.url}>{content}</StyledProjectGridItem>;
    }
  }
}
